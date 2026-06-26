package ma.pfe.rh.timesheets.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import ma.pfe.rh.timesheets.dto.CommentDto;
import ma.pfe.rh.timesheets.dto.TimesheetDraftRequest;
import ma.pfe.rh.timesheets.dto.TimesheetEntryRequest;
import ma.pfe.rh.timesheets.dto.TimesheetResponse;
import ma.pfe.rh.timesheets.service.TimesheetService;
import ma.pfe.rh.timesheets.web.security.Role;
import ma.pfe.rh.timesheets.integration.OrgDirectory;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/timesheets")
@RequiredArgsConstructor
public class TimesheetController {

    private final TimesheetService timesheetService;
    private final OrgDirectory orgDirectory;

    @GetMapping(value = "/current", produces = MediaType.APPLICATION_JSON_VALUE)
    public TimesheetResponse current(HttpServletRequest http) {
        return timesheetService.currentWeek(GatewayHeaders.requireUserId(http));
    }

    @GetMapping(value = "/week/{monday}", produces = MediaType.APPLICATION_JSON_VALUE)
    public TimesheetResponse getWeek(HttpServletRequest http, @PathVariable java.time.LocalDate monday) {
        return timesheetService.getWeek(GatewayHeaders.requireUserId(http), monday);
    }

    @GetMapping(value = "/my", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<TimesheetResponse> my(HttpServletRequest http) {
        return timesheetService.history(GatewayHeaders.requireUserId(http));
    }

    @PostMapping(value = "/{id}/entries", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public TimesheetResponse addEntry(HttpServletRequest http, @PathVariable long id, @Valid @RequestBody TimesheetEntryRequest req) {
        Role r = GatewayHeaders.requireRole(http);
        if (r != Role.EMPLOYEE && r != Role.MANAGER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Action réservée aux employés");
        }
        return timesheetService.addEntry(GatewayHeaders.requireUserId(http), r.name(), id, req);
    }

    @PostMapping(value = "/week/{monday}/draft", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public TimesheetResponse saveDraft(HttpServletRequest http, @PathVariable java.time.LocalDate monday, @RequestBody TimesheetDraftRequest req) {
        Role r = GatewayHeaders.requireRole(http);
        if (r != Role.EMPLOYEE && r != Role.MANAGER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Action reservee aux employes");
        }
        return timesheetService.saveDraft(GatewayHeaders.requireUserId(http), monday, req);
    }

    @DeleteMapping(value = "/{tsId}/entries/{entryId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public TimesheetResponse deleteEntry(HttpServletRequest http, @PathVariable long tsId, @PathVariable long entryId) {
        Role r = GatewayHeaders.requireRole(http);
        if (r != Role.EMPLOYEE && r != Role.MANAGER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Action réservée aux employés");
        }
        return timesheetService.deleteEntry(GatewayHeaders.requireUserId(http), tsId, entryId);
    }

    @PostMapping(value = "/{id}/reopen", produces = MediaType.APPLICATION_JSON_VALUE)
    public TimesheetResponse reopen(HttpServletRequest http, @PathVariable long id) {
        Role r = GatewayHeaders.requireRole(http);
        if (r != Role.EMPLOYEE && r != Role.MANAGER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Action réservée aux employés");
        }
        return timesheetService.reopenAfterReject(GatewayHeaders.requireUserId(http), id);
    }

    @PostMapping(value = "/{id}/submit", produces = MediaType.APPLICATION_JSON_VALUE)
    public TimesheetResponse submit(HttpServletRequest http, @PathVariable long id) {
        Role r = GatewayHeaders.requireRole(http);
        if (r != Role.EMPLOYEE && r != Role.MANAGER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Action réservée aux employés");
        }
        return timesheetService.submit(GatewayHeaders.requireUserId(http), id);
    }

    @GetMapping(value = "/manager/pending", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<TimesheetResponse> managerPending(HttpServletRequest http) {
        Role r = GatewayHeaders.requireRole(http);
        if (r != Role.MANAGER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Accès manager requis");
        }
        return timesheetService.managerTeam(GatewayHeaders.requireUserId(http));
    }

    @GetMapping(value = "/rh/all", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<TimesheetResponse> rhAll(HttpServletRequest http) {
        if (GatewayHeaders.requireRole(http) != Role.RH) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Accès RH requis");
        }
        return timesheetService.rhAll();
    }

    @PostMapping(value = "/{id}/approve", produces = MediaType.APPLICATION_JSON_VALUE)
    public TimesheetResponse approve(HttpServletRequest http, @PathVariable long id) {
        Role r = GatewayHeaders.requireRole(http);
        long currentUserId = GatewayHeaders.requireUserId(http);
        TimesheetResponse ts = timesheetService.getById(id);
        Long managerIdOfEmployee = orgDirectory.findManagerId(ts.getEmployeeId());

        if (r == Role.RH) {
            if (managerIdOfEmployee != null) {
                throw new ApiException(HttpStatus.FORBIDDEN, "Seul le manager direct peut valider cette feuille");
            }
        } else {
            if (managerIdOfEmployee == null || !managerIdOfEmployee.equals(currentUserId)) {
                throw new ApiException(HttpStatus.FORBIDDEN, "Vous n'êtes pas le manager direct de cet employé");
            }
        }
        return timesheetService.approve(id, currentUserId);
    }

    @PostMapping(value = "/{id}/reject", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public TimesheetResponse reject(HttpServletRequest http, @PathVariable long id, @RequestBody Map<String, String> body) {
        Role r = GatewayHeaders.requireRole(http);
        long currentUserId = GatewayHeaders.requireUserId(http);
        TimesheetResponse ts = timesheetService.getById(id);
        Long managerIdOfEmployee = orgDirectory.findManagerId(ts.getEmployeeId());

        if (r == Role.RH) {
            if (managerIdOfEmployee != null) {
                throw new ApiException(HttpStatus.FORBIDDEN, "Seul le manager direct peut rejeter cette feuille");
            }
        } else {
            if (managerIdOfEmployee == null || !managerIdOfEmployee.equals(currentUserId)) {
                throw new ApiException(HttpStatus.FORBIDDEN, "Vous n'êtes pas le manager direct de cet employé");
            }
        }

        String comment = body.get("commentaire");
        if (comment == null || comment.trim().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Le motif du rejet est obligatoire");
        }
        return timesheetService.reject(id, currentUserId, comment);
    }

    @PostMapping(value = "/manager/remind-missing", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Integer> remindMissing(HttpServletRequest http) {
        if (GatewayHeaders.requireRole(http) != Role.MANAGER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Acces manager requis");
        }
        java.time.LocalDate monday = java.time.LocalDate.now().with(java.time.DayOfWeek.MONDAY);
        return Map.of("count", timesheetService.remindMissingForManager(GatewayHeaders.requireUserId(http), monday));
    }

    @PostMapping(value = "/admin/reminders/test", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Integer> triggerReminderTest(HttpServletRequest http) {
        Role r = GatewayHeaders.requireRole(http);
        if (r != Role.RH && r != Role.ADMIN) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Acces RH requis");
        }
        java.time.LocalDate monday = java.time.LocalDate.now().with(java.time.DayOfWeek.MONDAY);
        return Map.of("count", timesheetService.remindMissingAutomatically(monday));
    }
}
