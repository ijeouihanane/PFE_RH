package ma.pfe.rh.chat.service;

import lombok.RequiredArgsConstructor;
import ma.pfe.rh.chat.domain.*;
import ma.pfe.rh.chat.dto.*;
import ma.pfe.rh.chat.integration.UserDirectory;
import ma.pfe.rh.chat.integration.UserSummary;
import ma.pfe.rh.chat.kafka.ChatKafkaProducer;
import ma.pfe.rh.chat.realtime.ChatSessionRegistry;
import ma.pfe.rh.chat.repo.*;
import ma.pfe.rh.chat.web.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.Normalizer;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatConversationRepository conversationRepository;
    private final ChatParticipantRepository participantRepository;
    private final ChatMessageRepository messageRepository;
    private final ChatAttachmentRepository attachmentRepository;
    private final ChatPresenceRepository presenceRepository;
    private final UserDirectory userDirectory;
    private final ChatKafkaProducer kafkaProducer;
    private final ChatSessionRegistry sessions;

    @Value("${app.uploads.dir}")
    private String uploadsDir;

    @Value("${app.chat.max-file-size-bytes}")
    private long maxFileSize;

    @Value("${app.chat.allowed-extensions}")
    private String allowedExtensions;

    @Transactional
    public List<ConversationResponse> conversations(Long userId, String role) {
        if (!"RH".equals(role)) {
            ensureConversationWithRh(userId, role);
        }
        List<ChatParticipant> mine = participantRepository.findByUserId(userId);
        if (mine.isEmpty()) {
            return List.of();
        }
        List<Long> ids = mine.stream().map(ChatParticipant::getConversationId).toList();
        Map<Long, ChatParticipant> mineByConversation = mine.stream()
                .collect(Collectors.toMap(ChatParticipant::getConversationId, Function.identity()));
        Map<Long, ChatMessage> lastByConversation = messageRepository.findLastMessages(ids).stream()
                .collect(Collectors.toMap(ChatMessage::getConversationId, Function.identity()));
        return ids.stream()
                .map(id -> toConversationResponse(id, userId, mineByConversation.get(id), lastByConversation.get(id)))
                .sorted(Comparator.comparing(ConversationResponse::lastMessageAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    @Transactional
    public ConversationResponse createConversation(Long actorId, String actorRole, Long recipientId) {
        if (!"RH".equals(actorRole)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Seul le RH peut démarrer une conversation");
        }
        UserSummary recipient = userDirectory.requireActiveUser(recipientId);
        if (!("EMPLOYEE".equals(recipient.role()) || "MANAGER".equals(recipient.role()))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Le RH peut contacter seulement un employé ou un manager");
        }
        Long conversationId = findOrCreatePair(actorId, actorRole, recipient.id(), recipient.role());
        ChatParticipant mine = participantRepository.findByConversationIdAndUserId(conversationId, actorId).orElseThrow();
        ChatMessage last = messageRepository.findTopByConversationIdAndDeletedAtIsNullOrderByCreatedAtDesc(conversationId).orElse(null);
        return toConversationResponse(conversationId, actorId, mine, last);
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> messages(Long actorId, Long conversationId) {
        requireParticipant(conversationId, actorId);
        return messageRepository.findByConversationIdAndDeletedAtIsNullOrderByCreatedAtAsc(conversationId)
                .stream()
                .map(message -> toMessageResponse(message, actorId))
                .toList();
    }

    @Transactional
    public MessageResponse sendMessage(Long actorId, String actorRole, Long conversationId, String content) {
        requireParticipant(conversationId, actorId);
        String clean = content == null ? "" : content.trim();
        if (clean.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Message vide");
        }
        ChatMessage message = messageRepository.save(ChatMessage.builder()
                .conversationId(conversationId)
                .senderId(actorId)
                .content(clean)
                .messageType(MessageType.TEXT)
                .createdAt(Instant.now())
                .build());
        afterMessageCreated(message, actorId, actorRole);
        return toMessageResponse(message, actorId);
    }

    @Transactional
    public MessageResponse sendAttachment(Long actorId, String actorRole, Long conversationId, MultipartFile file) throws IOException {
        requireParticipant(conversationId, actorId);
        validateFile(file);
        ChatMessage message = messageRepository.save(ChatMessage.builder()
                .conversationId(conversationId)
                .senderId(actorId)
                .content(file.getOriginalFilename())
                .messageType(MessageType.FILE)
                .createdAt(Instant.now())
                .build());
        String safeName = safeFileName(file.getOriginalFilename());
        String ext = extension(safeName);
        String storedName = UUID.randomUUID() + (ext.isBlank() ? "" : "." + ext);
        Path dir = Path.of(uploadsDir, String.valueOf(conversationId)).toAbsolutePath().normalize();
        Files.createDirectories(dir);
        Path target = dir.resolve(storedName).normalize();
        file.transferTo(target);
        attachmentRepository.save(ChatAttachment.builder()
                .messageId(message.getId())
                .fileName(safeName)
                .filePath(target.toString())
                .fileType(file.getContentType())
                .fileSize(file.getSize())
                .uploadedAt(Instant.now())
                .build());
        afterMessageCreated(message, actorId, actorRole);
        return toMessageResponse(message, actorId);
    }

    @Transactional
    public void markRead(Long actorId, Long conversationId) {
        ChatParticipant participant = requireParticipant(conversationId, actorId);
        ChatMessage last = messageRepository.findTopByConversationIdAndDeletedAtIsNullOrderByCreatedAtDesc(conversationId).orElse(null);
        if (last != null) {
            if (participant.getLastReadMessageId() != null && participant.getLastReadMessageId() >= last.getId()) {
                return;
            }
            participant.setLastReadMessageId(last.getId());
            participant.setLastReadAt(Instant.now());
            participantRepository.save(participant);
            broadcastToConversation(conversationId, "CONVERSATION_READ", Map.of(
                    "conversationId", conversationId,
                    "userId", actorId,
                    "lastReadMessageId", last.getId()
            ));
        }
    }

    @Transactional
    public void deleteMessage(Long actorId, Long messageId) {
        ChatMessage message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Message introuvable"));
        requireParticipant(message.getConversationId(), actorId);
        if (!message.getSenderId().equals(actorId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Vous pouvez supprimer seulement vos messages");
        }
        message.setDeletedAt(Instant.now());
        message.setDeletedBy(actorId);
        messageRepository.save(message);
        broadcastToConversation(message.getConversationId(), "MESSAGE_DELETED", Map.of(
                "conversationId", message.getConversationId(),
                "messageId", message.getId()
        ));
    }

    @Transactional(readOnly = true)
    public DownloadFile downloadAttachment(Long actorId, Long attachmentId) {
        ChatAttachment attachment = attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Fichier introuvable"));
        ChatMessage message = messageRepository.findById(attachment.getMessageId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Message introuvable"));
        requireParticipant(message.getConversationId(), actorId);
        Resource resource = new FileSystemResource(attachment.getFilePath());
        if (!resource.exists()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Fichier introuvable");
        }
        return new DownloadFile(resource, attachment.getFileName(), attachment.getFileType());
    }

    @Transactional
    public void setOnline(Long userId, boolean online) {
        ChatPresence presence = presenceRepository.findById(userId)
                .orElse(ChatPresence.builder().userId(userId).build());
        presence.setOnline(online);
        presence.setLastSeenAt(Instant.now());
        presenceRepository.save(presence);
        participantRepository.findByUserId(userId).forEach(p ->
                broadcastToConversation(p.getConversationId(), "PRESENCE_CHANGED", Map.of(
                        "userId", userId,
                        "online", online,
                        "lastSeenAt", presence.getLastSeenAt().toString()
                ))
        );
    }

    private void ensureConversationWithRh(Long userId, String role) {
        UserSummary rh = userDirectory.requireFirstActiveRh();
        if (!rh.id().equals(userId)) {
            findOrCreatePair(rh.id(), "RH", userId, role);
        }
    }

    private Long findOrCreatePair(Long rhId, String rhRole, Long otherId, String otherRole) {
        List<Long> existing = participantRepository.findConversationIdsForPair(rhId, otherId);
        if (!existing.isEmpty()) {
            return existing.get(0);
        }
        ChatConversation conversation = conversationRepository.save(ChatConversation.builder()
                .type(ConversationType.PRIVATE)
                .createdBy(rhId)
                .createdAt(Instant.now())
                .build());
        participantRepository.save(ChatParticipant.builder()
                .conversationId(conversation.getId())
                .userId(rhId)
                .userRole(rhRole)
                .joinedAt(Instant.now())
                .build());
        participantRepository.save(ChatParticipant.builder()
                .conversationId(conversation.getId())
                .userId(otherId)
                .userRole(otherRole)
                .joinedAt(Instant.now())
                .build());
        return conversation.getId();
    }

    private ChatParticipant requireParticipant(Long conversationId, Long userId) {
        return participantRepository.findByConversationIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "Accès conversation refusé"));
    }

    private ConversationResponse toConversationResponse(Long conversationId, Long viewerId, ChatParticipant mine, ChatMessage last) {
        ChatParticipant contactParticipant = participantRepository.findByConversationId(conversationId).stream()
                .filter(p -> !p.getUserId().equals(viewerId))
                .findFirst()
                .orElseThrow();
        UserSummary contact = userDirectory.requireActiveUser(contactParticipant.getUserId());
        ChatPresence presence = presenceRepository.findById(contact.id()).orElse(null);
        long unread = mine.getLastReadMessageId() == null
                ? messageRepository.countByConversationIdAndSenderIdNotAndDeletedAtIsNull(conversationId, viewerId)
                : messageRepository.countByConversationIdAndIdGreaterThanAndSenderIdNotAndDeletedAtIsNull(
                        conversationId,
                        mine.getLastReadMessageId(),
                        viewerId
                );
        return new ConversationResponse(
                conversationId,
                contact.id(),
                contact.fullName(),
                contact.role(),
                contact.photoUrl(),
                presence != null && presence.isOnline(),
                presence == null ? null : presence.getLastSeenAt(),
                preview(last),
                last == null ? null : last.getCreatedAt(),
                unread
        );
    }

    private MessageResponse toMessageResponse(ChatMessage message, Long viewerId) {
        ChatAttachment attachment = attachmentRepository.findByMessageId(message.getId()).orElse(null);
        ChatParticipant contactParticipant = participantRepository.findByConversationId(message.getConversationId()).stream()
                .filter(p -> !p.getUserId().equals(message.getSenderId()))
                .findFirst()
                .orElse(null);
        boolean readByContact = contactParticipant != null
                && contactParticipant.getLastReadMessageId() != null
                && contactParticipant.getLastReadMessageId() >= message.getId();
        return new MessageResponse(
                message.getId(),
                message.getConversationId(),
                message.getSenderId(),
                message.getContent(),
                message.getMessageType(),
                message.getCreatedAt(),
                message.getSenderId().equals(viewerId),
                readByContact,
                attachment == null ? null : new AttachmentResponse(
                        attachment.getId(),
                        attachment.getFileName(),
                        attachment.getFileType(),
                        attachment.getFileSize(),
                        "/api/chat/attachments/" + attachment.getId() + "/download"
                )
        );
    }

    private void afterMessageCreated(ChatMessage message, Long actorId, String actorRole) {
        participantRepository.findByConversationId(message.getConversationId())
                .forEach(p -> {
                    MessageResponse response = toMessageResponse(message, p.getUserId());
                    if (p.getUserId().equals(actorId)) {
                        response = new MessageResponse(
                                response.id(),
                                response.conversationId(),
                                response.senderId(),
                                response.content(),
                                response.messageType(),
                                response.createdAt(),
                                response.mine(),
                                false,
                                response.attachment()
                        );
                    }
                    sessions.sendToUser(p.getUserId(), "MESSAGE_CREATED", response);
                });
        participantRepository.findByConversationId(message.getConversationId()).stream()
                .filter(p -> !p.getUserId().equals(actorId))
                .forEach(p -> {
                    UserSummary sender = userDirectory.requireActiveUser(actorId);
                    kafkaProducer.messageCreated(Map.of(
                            "recipientId", p.getUserId(),
                            "senderId", actorId,
                            "senderName", sender.fullName(),
                            "senderRole", actorRole,
                            "conversationId", message.getConversationId(),
                            "messageId", message.getId(),
                            "messagePreview", preview(message)
                    ));
                });
    }

    private void broadcastToConversation(Long conversationId, String type, Object payload) {
        participantRepository.findByConversationId(conversationId)
                .forEach(p -> sessions.sendToUser(p.getUserId(), type, payload));
    }

    private String preview(ChatMessage message) {
        if (message == null) {
            return "";
        }
        if (message.getMessageType() == MessageType.FILE) {
            return "[Fichier] " + message.getContent();
        }
        String content = message.getContent() == null ? "" : message.getContent();
        return content.length() <= 80 ? content : content.substring(0, 77) + "...";
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Fichier vide");
        }
        if (file.getSize() > maxFileSize) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Fichier trop volumineux");
        }
        String ext = extension(file.getOriginalFilename());
        Set<String> allowed = Arrays.stream(allowedExtensions.split(","))
                .map(String::trim)
                .map(String::toLowerCase)
                .collect(Collectors.toSet());
        if (!allowed.contains(ext)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Type de fichier non autorisé");
        }
    }

    private String safeFileName(String original) {
        String name = original == null || original.isBlank() ? "fichier" : original;
        name = Path.of(name).getFileName().toString();
        name = Normalizer.normalize(name, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return name.replaceAll("[^a-zA-Z0-9._-]", "-");
    }

    private String extension(String name) {
        if (name == null) {
            return "";
        }
        int i = name.lastIndexOf('.');
        return i < 0 ? "" : name.substring(i + 1).toLowerCase();
    }

    public record DownloadFile(Resource resource, String fileName, String fileType) {
    }
}
