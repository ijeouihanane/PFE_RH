package ma.pfe.rh.users.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import ma.pfe.rh.users.web.GatewayHeaders;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class GatewayAuthFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String uri = request.getRequestURI();
        if (uri.startsWith("/actuator")) {
            filterChain.doFilter(request, response);
            return;
        }
        if (uri.equals("/api/auth/login") || uri.startsWith("/api/auth/login/")) {
            filterChain.doFilter(request, response);
            return;
        }
        if (uri.startsWith("/uploads")) {
            filterChain.doFilter(request, response);
            return;
        }
        if (GatewayHeaders.userId(request).isEmpty()) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Requête non authentifiée (passer par la gateway)");
            return;
        }
        filterChain.doFilter(request, response);
    }
}
