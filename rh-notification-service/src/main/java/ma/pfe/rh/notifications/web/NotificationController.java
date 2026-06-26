package ma.pfe.rh.notifications.web;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import ma.pfe.rh.notifications.dto.NotificationResponse;
import ma.pfe.rh.notifications.service.NotificationService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping(value = "/me", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<NotificationResponse> me(HttpServletRequest http) {
        return notificationService.listForUser(GatewayHeaders.requireUserId(http));
    }

    @PostMapping("/{id}/read")
    public void read(HttpServletRequest http, @PathVariable long id) {
        notificationService.markRead(GatewayHeaders.requireUserId(http), id);
    }
}
