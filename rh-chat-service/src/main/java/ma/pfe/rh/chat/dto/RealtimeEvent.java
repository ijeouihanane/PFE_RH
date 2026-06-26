package ma.pfe.rh.chat.dto;

public record RealtimeEvent(
        String type,
        Object payload
) {
}
