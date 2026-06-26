package ma.pfe.rh.users.web;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import ma.pfe.rh.users.domain.Role;
import ma.pfe.rh.users.dto.AdminDashboardSummaryResponse;
import ma.pfe.rh.users.dto.CreateAccountResultResponse;
import ma.pfe.rh.users.dto.UserResponse;
import ma.pfe.rh.users.service.AdminAccountService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/users/admin")
@RequiredArgsConstructor
public class AdminAccountController {

    private final AdminAccountService adminAccountService;

    @GetMapping(value = "/pending", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<UserResponse> pending(HttpServletRequest http) {
        requireAdmin(http);
        return adminAccountService.pending();
    }

    @GetMapping(value = "/active", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<UserResponse> active(HttpServletRequest http) {
        requireAdmin(http);
        return adminAccountService.activeAccounts();
    }

    @GetMapping(value = "/disabled", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<UserResponse> disabled(HttpServletRequest http) {
        requireAdmin(http);
        return adminAccountService.disabledAccounts();
    }

    @GetMapping(value = "/dashboard-summary", produces = MediaType.APPLICATION_JSON_VALUE)
    public AdminDashboardSummaryResponse dashboardSummary(HttpServletRequest http) {
        requireAdmin(http);
        return adminAccountService.dashboardSummary();
    }

    @PostMapping(value = "/{id}/create-account", produces = MediaType.APPLICATION_JSON_VALUE)
    public CreateAccountResultResponse createAccount(HttpServletRequest http, @PathVariable Long id) {
        requireAdmin(http);
        return adminAccountService.createAccount(id);
    }

    @PostMapping(value = "/{id}/reset-password", produces = MediaType.APPLICATION_JSON_VALUE)
    public CreateAccountResultResponse resetPassword(HttpServletRequest http, @PathVariable Long id) {
        requireAdmin(http);
        return adminAccountService.resetPassword(id);
    }

    @PostMapping("/{id}/deactivate")
    public void deactivate(HttpServletRequest http, @PathVariable Long id) {
        requireAdmin(http);
        adminAccountService.deactivateAccount(id);
    }

    @PostMapping("/{id}/reactivate")
    public void reactivate(HttpServletRequest http, @PathVariable Long id) {
        requireAdmin(http);
        adminAccountService.reactivateAccount(id);
    }

    private static void requireAdmin(HttpServletRequest http) {
        Role r = GatewayHeaders.requireRole(http);
        if (r != Role.ADMIN) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Accès administrateur requis");
        }
    }
}
