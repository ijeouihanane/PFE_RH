package ma.pfe.rh.chat.dto;

import ma.pfe.rh.chat.domain.MessageType;

import java.time.Instant;

public record MessageResponse(
        Long id,
        Long conversationId,
        Long senderId,
        String content,
        MessageType messageType,
        Instant createdAt,
        boolean mine,
        boolean readByContact,
        AttachmentResponse attachment
) {
}
