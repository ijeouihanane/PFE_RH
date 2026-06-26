package ma.pfe.rh.leaves.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import ma.pfe.rh.leaves.domain.LeaveStatus;
import ma.pfe.rh.leaves.domain.LeaveType;
import ma.pfe.rh.leaves.dto.CommentDto;
import ma.pfe.rh.leaves.dto.LeaveBalanceResponse;
import ma.pfe.rh.leaves.dto.LeaveHistoryResponse;
import ma.pfe.rh.leaves.dto.LeaveRequestCreateDto;
import ma.pfe.rh.leaves.dto.LeaveRequestResponse;
import ma.pfe.rh.leaves.dto.PublicHolidayDto;
import ma.pfe.rh.leaves.dto.PublicHolidayRequest;
import ma.pfe.rh.leaves.integration.UserDirectory;
import ma.pfe.rh.leaves.service.HolidayService;
import ma.pfe.rh.leaves.service.LeaveService;
import ma.pfe.rh.leaves.web.security.Role;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/leaves")
@RequiredArgsConstructor
public class LeaveController {

    private final LeaveService leaveService;
    private final HolidayService holidayService;
    private final UserDirectory userDirectory;

    @GetMapping(value = "/balances/me", produces = MediaType.APPLICATION_JSON_VALUE)
    public LeaveBalanceResponse myBalance(HttpServletRequest http, @RequestParam(required = false) Integer annee) {
        return leaveService.balanceForEmployee(GatewayHeaders.requireUserId(http), annee);
    }

    @GetMapping(value = "/balances/employee/{employeeId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public LeaveBalanceResponse employeeBalance(HttpServletRequest http, @PathVariable Long employeeId, @RequestParam(required = false) Integer annee) {
        Role role = GatewayHeaders.requireRole(http);
        if (role != Role.RH) {
            long uid = GatewayHeaders.requireUserId(http);
            Long managerId = userDirectory.findManagerId(employeeId);
            if (role != Role.MANAGER || managerId == null || managerId != uid) {
                throw new ApiException(HttpStatus.FORBIDDEN, "Acces RH ou manager direct requis");
            }
        }
        return leaveService.balanceForEmployee(employeeId, annee);
    }

    @GetMapping(value = "/holidays", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<PublicHolidayDto> publicHolidays(HttpServletRequest http, @RequestParam(required = false) Integer year) {
        GatewayHeaders.requireUserId(http);
        return holidayService.holidays(year == null ? LocalDate.now().getYear() : year);
    }

    @GetMapping(value = "/my", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<LeaveRequestResponse> myRequests(HttpServletRequest http) {
        return leaveService.myRequests(GatewayHeaders.requireUserId(http));
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public LeaveRequestResponse create(HttpServletRequest http, @Valid @RequestBody LeaveRequestCreateDto dto) {
        long uid = GatewayHeaders.requireUserId(http);
        Role role = GatewayHeaders.requireRole(http);
        return leaveService.create(uid, role, dto);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public LeaveRequestResponse createMultipart(
            HttpServletRequest http,
            @RequestParam LeaveType typeConge,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateDebut,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFin,
            @RequestParam(required = false) String motif,
            @RequestParam(required = false) MultipartFile justificatif
    ) {
        LeaveRequestCreateDto dto = new LeaveRequestCreateDto();
        dto.setTypeConge(typeConge);
        dto.setDateDebut(dateDebut);
        dto.setDateFin(dateFin);
        dto.setMotif(motif);
        if (justificatif != null && !justificatif.isEmpty()) {
            LeaveService.AttachmentMeta meta = leaveService.storeAttachment(justificatif);
            dto.setJustificatifName(meta.name());
            dto.setJustificatifUrl(meta.url());
            dto.setJustificatifType(meta.type());
        }
        return leaveService.create(GatewayHeaders.requireUserId(http), GatewayHeaders.requireRole(http), dto);
    }

    @GetMapping(value = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public LeaveRequestResponse detail(HttpServletRequest http, @PathVariable long id) {
        GatewayHeaders.requireUserId(http);
        return leaveService.detail(id);
    }

    @GetMapping(value = "/{id}/history", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<LeaveHistoryResponse> history(HttpServletRequest http, @PathVariable long id) {
        GatewayHeaders.requireUserId(http);
        return leaveService.history(id);
    }

    @PostMapping(value = "/{id}/attachment", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public LeaveRequestResponse attachment(HttpServletRequest http, @PathVariable long id, @RequestParam MultipartFile file) {
        return leaveService.attach(GatewayHeaders.requireUserId(http), id, file);
    }

    @PostMapping("/{id}/cancel")
    public LeaveRequestResponse cancel(HttpServletRequest http, @PathVariable long id) {
        return leaveService.cancel(GatewayHeaders.requireUserId(http), id);
    }

    @GetMapping(value = "/manager/pending", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<LeaveRequestResponse> managerPending(HttpServletRequest http) {
        requireManager(http);
        return leaveService.managerPending(GatewayHeaders.requireUserId(http));
    }

    @GetMapping(value = "/manager/team-approved", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<LeaveRequestResponse> teamApproved(HttpServletRequest http, @RequestParam(required = false) LocalDate from) {
        requireManager(http);
        return leaveService.teamApprovedUpcoming(GatewayHeaders.requireUserId(http), from);
    }

    @GetMapping(value = "/manager/search", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<LeaveRequestResponse> teamSearch(HttpServletRequest http, @RequestParam(required = false) LeaveStatus statut) {
        requireManager(http);
        return leaveService.teamSearch(GatewayHeaders.requireUserId(http), statut);
    }

    @PostMapping("/{id}/manager/approve")
    public LeaveRequestResponse managerApprove(HttpServletRequest http, @PathVariable long id) {
        requireManager(http);
        return leaveService.managerApprove(GatewayHeaders.requireUserId(http), id);
    }

    @PostMapping(value = "/{id}/manager/reject", consumes = MediaType.APPLICATION_JSON_VALUE)
    public LeaveRequestResponse managerReject(HttpServletRequest http, @PathVariable long id, @RequestBody CommentDto dto) {
        requireManager(http);
        return leaveService.managerReject(GatewayHeaders.requireUserId(http), id, dto);
    }

    @GetMapping(value = "/rh/queue", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<LeaveRequestResponse> rhQueue(HttpServletRequest http) {
        requireRh(http);
        return leaveService.rhQueue();
    }

    @GetMapping(value = "/rh/search", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<LeaveRequestResponse> rhSearch(
            HttpServletRequest http,
            @RequestParam(required = false) Long employeeId,
            @RequestParam(required = false) LeaveStatus statut,
            @RequestParam(required = false) LeaveType type
    ) {
        requireRh(http);
        return leaveService.rhSearch(employeeId, statut, type);
    }

    @GetMapping(value = "/rh/dashboard", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Long> rhDashboard(HttpServletRequest http) {
        requireRh(http);
        return leaveService.rhDashboard();
    }

    @PostMapping("/{id}/rh/approve")
    public LeaveRequestResponse rhApprove(HttpServletRequest http, @PathVariable long id) {
        requireRh(http);
        return leaveService.rhApprove(GatewayHeaders.requireUserId(http), id);
    }

    @PostMapping(value = "/{id}/rh/reject", consumes = MediaType.APPLICATION_JSON_VALUE)
    public LeaveRequestResponse rhReject(HttpServletRequest http, @PathVariable long id, @RequestBody CommentDto dto) {
        requireRh(http);
        return leaveService.rhReject(GatewayHeaders.requireUserId(http), id, dto);
    }

    @PostMapping(value = "/{id}/rh/cancel", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public LeaveRequestResponse rhCancel(HttpServletRequest http, @PathVariable long id, @RequestBody(required = false) CommentDto dto) {
        requireRh(http);
        return leaveService.rhCancel(GatewayHeaders.requireUserId(http), id, dto);
    }

    @GetMapping(value = "/rh/holidays", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<PublicHolidayDto> holidays(HttpServletRequest http, @RequestParam(required = false) Integer year) {
        requireRh(http);
        return holidayService.holidays(year == null ? LocalDate.now().getYear() : year);
    }

    @PostMapping(value = "/rh/holidays/sync", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<PublicHolidayDto> syncHolidays(HttpServletRequest http) {
        requireRh(http);
        return holidayService.syncCurrentAndNextYears();
    }

    @PostMapping(value = "/rh/holidays", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public PublicHolidayDto createHoliday(HttpServletRequest http, @Valid @RequestBody PublicHolidayRequest request) {
        requireRh(http);
        return holidayService.createManual(request);
    }

    @PutMapping(value = "/rh/holidays/{id}", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public PublicHolidayDto updateHoliday(HttpServletRequest http, @PathVariable long id, @Valid @RequestBody PublicHolidayRequest request) {
        requireRh(http);
        return holidayService.updateManualOrReligious(id, request);
    }

    private static void requireRh(HttpServletRequest http) {
        if (GatewayHeaders.requireRole(http) != Role.RH) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Accès RH requis");
        }
    }

    private static void requireManager(HttpServletRequest http) {
        if (GatewayHeaders.requireRole(http) != Role.MANAGER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Accès manager requis");
        }
    }
}
