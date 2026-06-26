package ma.pfe.rh.leaves.web;

import jakarta.servlet.http.HttpServletRequest;
import ma.pfe.rh.leaves.web.security.Role;

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

    public static Optional<Role> role(HttpServletRequest request) {
        String v = request.getHeader("X-User-Role");
        if (v == null || v.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(Role.valueOf(v));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    public static Long requireUserId(HttpServletRequest request) {
        return userId(request).orElseThrow(() -> new IllegalStateException("Utilisateur non authentifié (gateway)"));
    }

    public static Role requireRole(HttpServletRequest request) {
        return role(request).orElseThrow(() -> new IllegalStateException("Rôle manquant (gateway)"));
    }
}
