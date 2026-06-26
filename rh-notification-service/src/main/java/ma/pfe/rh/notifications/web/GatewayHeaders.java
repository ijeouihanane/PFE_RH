package ma.pfe.rh.notifications.web;

import jakarta.servlet.http.HttpServletRequest;

import java.util.Optional;

public final class GatewayHeaders {

    private GatewayHeaders() {
    }

    public static Optional<Long> userId(HttpServletRequest request) {
        String v = request.getHeader("X-User-Id");
        if (v == null || v.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(Long.parseLong(v));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    public static long requireUserId(HttpServletRequest request) {
        return userId(request).orElseThrow(() -> new IllegalStateException("Utilisateur non authentifié (gateway)"));
    }
}
