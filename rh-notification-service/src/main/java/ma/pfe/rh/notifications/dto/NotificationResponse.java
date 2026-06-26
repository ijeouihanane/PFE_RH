package ma.pfe.rh.notifications.dto;

import lombok.Builder;
import lombok.Value;
import ma.pfe.rh.notifications.domain.NotificationEntity;
import ma.pfe.rh.notifications.domain.NotificationType;

import java.time.Instant;

@Value
@Builder
public class NotificationResponse {
    Long id;
    Long userId;
    String titre;
    String message;
    NotificationType type;
    boolean lu;
    Instant createdAt;
    Long chatConversationId;
    Long chatMessageId;

    public static NotificationResponse from(NotificationEntity e) {
        return NotificationResponse.builder()
                .id(e.getId())
                .userId(e.getUserId())
                .titre(e.getTitre())
                .message(e.getMessage())
                .type(e.getType())
                .lu(e.isLu())
                .createdAt(e.getCreatedAt())
                .chatConversationId(e.getChatConversationId())
                .chatMessageId(e.getChatMessageId())
                .build();
    }
}
