package ma.pfe.rh.users.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import ma.pfe.rh.users.domain.Role;
import ma.pfe.rh.users.dto.AppraisalContextResponse;
import ma.pfe.rh.users.dto.AppraisalDraftRequest;
import ma.pfe.rh.users.dto.AppraisalResponse;
import ma.pfe.rh.users.dto.EmployeeAcknowledgementRequest;
import ma.pfe.rh.users.service.AppraisalService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/appraisals")
@RequiredArgsConstructor
public class AppraisalController {

    private final AppraisalService appraisalService;

    @GetMapping(value = "/context/{employeeId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public AppraisalContextResponse context(HttpServletRequest http, @PathVariable Long employeeId) {
        requireRole(http, Role.MANAGER);
        return appraisalService.context(GatewayHeaders.requireUserId(http), employeeId);
    }

    @GetMapping(value = "/draft/{id}/context", produces = MediaType.APPLICATION_JSON_VALUE)
    public AppraisalContextResponse draftContext(HttpServletRequest http, @PathVariable Long id) {
        requireRole(http, Role.MANAGER);
        return appraisalService.draftContext(GatewayHeaders.requireUserId(http), id);
    }

    @PostMapping(value = "/draft", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public AppraisalResponse createDraft(HttpServletRequest http, @Valid @RequestBody AppraisalDraftRequest request) {
        requireRole(http, Role.MANAGER);
        return appraisalService.saveDraft(GatewayHeaders.requireUserId(http), request);
    }

    @PatchMapping(value = "/{id}/draft", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public AppraisalResponse updateDraft(
            HttpServletRequest http,
            @PathVariable Long id,
            @Valid @RequestBody AppraisalDraftRequest request
    ) {
        requireRole(http, Role.MANAGER);
        return appraisalService.updateDraft(GatewayHeaders.requireUserId(http), id, request);
    }

    @PostMapping(value = "/{id}/submit", produces = MediaType.APPLICATION_JSON_VALUE)
    public AppraisalResponse submit(HttpServletRequest http, @PathVariable Long id) {
        requireRole(http, Role.MANAGER);
        return appraisalService.submit(GatewayHeaders.requireUserId(http), id);
    }

    @GetMapping(value = "/my-team", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<AppraisalResponse> myTeam(HttpServletRequest http) {
        requireRole(http, Role.MANAGER);
        return appraisalService.forManager(GatewayHeaders.requireUserId(http));
    }

    @GetMapping(value = "/me", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<AppraisalResponse> mine(HttpServletRequest http) {
        Role role = GatewayHeaders.requireRole(http);
        if (role != Role.EMPLOYEE && role != Role.MANAGER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Accès employé requis");
        }
        return appraisalService.forEmployee(GatewayHeaders.requireUserId(http));
    }

    @GetMapping(value = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public AppraisalResponse detail(HttpServletRequest http, @PathVariable Long id) {
        return appraisalService.detail(
                GatewayHeaders.requireUserId(http),
                GatewayHeaders.requireRole(http),
                id
        );
    }

    @PostMapping(value = "/{id}/acknowledge", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public AppraisalResponse acknowledge(
            HttpServletRequest http,
            @PathVariable Long id,
            @RequestBody EmployeeAcknowledgementRequest request
    ) {
        Role role = GatewayHeaders.requireRole(http);
        if (role != Role.EMPLOYEE && role != Role.MANAGER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Accès employé requis");
        }
        return appraisalService.acknowledge(
                GatewayHeaders.requireUserId(http),
                id,
                request.getEmployeeComment()
        );
    }

    @PostMapping(value = "/{id}/rh-validate", produces = MediaType.APPLICATION_JSON_VALUE)
    public AppraisalResponse validateRh(HttpServletRequest http, @PathVariable Long id) {
        requireRole(http, Role.RH);
        return appraisalService.validateRh(GatewayHeaders.requireUserId(http), id);
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public List<AppraisalResponse> allRh(HttpServletRequest http) {
        requireRole(http, Role.RH);
        return appraisalService.allForRh(GatewayHeaders.requireUserId(http));
    }

    private static void requireRole(HttpServletRequest http, Role expected) {
        if (GatewayHeaders.requireRole(http) != expected) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Permission refusée");
        }
    }
}
