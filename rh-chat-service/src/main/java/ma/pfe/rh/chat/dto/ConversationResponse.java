package ma.pfe.rh.chat.dto;

import java.time.Instant;

public record ConversationResponse(
        Long id,
        Long contactId,
        String contactName,
        String contactRole,
        String contactPhotoUrl,
        boolean contactOnline,
        Instant contactLastSeenAt,
        String lastMessagePreview,
        Instant lastMessageAt,
        long unreadCount
) {
}
