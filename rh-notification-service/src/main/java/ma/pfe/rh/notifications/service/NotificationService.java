package ma.pfe.rh.notifications.service;

import lombok.RequiredArgsConstructor;
import ma.pfe.rh.notifications.domain.NotificationEntity;
import ma.pfe.rh.notifications.domain.NotificationType;
import ma.pfe.rh.notifications.dto.NotificationResponse;
import ma.pfe.rh.notifications.repo.NotificationRepository;
import ma.pfe.rh.notifications.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;

    @Transactional
    public void notifyUser(long userId, String titre, String message, NotificationType type) {
        NotificationEntity n = NotificationEntity.builder()
                .userId(userId)
                .titre(titre)
                .message(message)
                .type(type)
                .lu(false)
                .createdAt(Instant.now())
                .build();
        notificationRepository.save(n);
    }

    @Transactional
    public void notifyChatMessage(long userId, String titre, String message, long conversationId, long messageId) {
        NotificationEntity n = NotificationEntity.builder()
                .userId(userId)
                .titre(titre)
                .message(message)
                .type(NotificationType.CHAT)
                .lu(false)
                .createdAt(Instant.now())
                .chatConversationId(conversationId)
                .chatMessageId(messageId)
                .build();
        notificationRepository.save(n);
    }

    public void notifyMany(Iterable<Long> userIds, String titre, String message, NotificationType type) {
        for (Long id : userIds) {
            notifyUser(id, titre, message, type);
        }
    }

    public List<NotificationResponse> listForUser(long userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(NotificationResponse::from)
                .toList();
    }

    @Transactional
    public void markRead(long userId, long notificationId) {
        NotificationEntity n = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Notification introuvable"));
        if (!n.getUserId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Accès refusé");
        }
        n.setLu(true);
        notificationRepository.save(n);
    }
}
