package ma.pfe.rh.chat.web;

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
        return Optional.of(Long.parseLong(v));
    }

    public static Long requireUserId(HttpServletRequest request) {
        return userId(request).orElseThrow(() -> new IllegalStateException("Utilisateur manquant (gateway)"));
    }

    public static String requireRole(HttpServletRequest request) {
        String v = request.getHeader("X-User-Role");
        if (v == null || v.isBlank()) {
            throw new IllegalStateException("Rôle manquant (gateway)");
        }
        return v;
    }
}
