package ma.pfe.rh.payroll.web;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import ma.pfe.rh.payroll.dto.EmployeeExpenseClaimRequest;
import ma.pfe.rh.payroll.dto.EmployeeExpenseClaimResponse;
import ma.pfe.rh.payroll.dto.EmployeeExpenseClaimSummaryResponse;
import ma.pfe.rh.payroll.dto.ReimburseExpenseClaimRequest;
import ma.pfe.rh.payroll.dto.RejectExpenseClaimRequest;
import ma.pfe.rh.payroll.service.EmployeeExpenseClaimService;
import ma.pfe.rh.payroll.web.security.Role;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/expense-claims")
@RequiredArgsConstructor
public class EmployeeExpenseClaimController {

    private final EmployeeExpenseClaimService service;

    @GetMapping(value = "/my", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<EmployeeExpenseClaimResponse> myClaims(HttpServletRequest http) {
        requireEmployeeOrManager(http);
        return service.myClaims(GatewayHeaders.requireUserId(http));
    }

    @GetMapping(value = "/my/summary", produces = MediaType.APPLICATION_JSON_VALUE)
    public EmployeeExpenseClaimSummaryResponse mySummary(HttpServletRequest http) {
        requireEmployeeOrManager(http);
        return service.mySummary(GatewayHeaders.requireUserId(http));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<EmployeeExpenseClaimResponse> create(
        HttpServletRequest http,
        @ModelAttribute EmployeeExpenseClaimRequest request,
        @RequestParam MultipartFile justificatif
    ) {
        requireEmployeeOrManager(http);
        EmployeeExpenseClaimResponse response = service.create(GatewayHeaders.requireUserId(http), request, justificatif);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public EmployeeExpenseClaimResponse update(
        HttpServletRequest http,
        @PathVariable Long id,
        @ModelAttribute EmployeeExpenseClaimRequest request,
        @RequestParam(required = false) MultipartFile justificatif
    ) {
        requireEmployeeOrManager(http);
        return service.update(id, GatewayHeaders.requireUserId(http), request, justificatif);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(HttpServletRequest http, @PathVariable Long id) {
        requireEmployeeOrManager(http);
        service.delete(id, GatewayHeaders.requireUserId(http));
        return ResponseEntity.noContent().build();
    }

    @GetMapping(value = "/rh", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<EmployeeExpenseClaimResponse> rhClaims(HttpServletRequest http) {
        requireRh(http);
        return service.rhClaims();
    }

    @GetMapping(value = "/rh/summary", produces = MediaType.APPLICATION_JSON_VALUE)
    public EmployeeExpenseClaimSummaryResponse rhSummary(HttpServletRequest http) {
        requireRh(http);
        return service.rhSummary();
    }

    @GetMapping(value = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public EmployeeExpenseClaimResponse get(HttpServletRequest http, @PathVariable Long id) {
        Role role = GatewayHeaders.requireRole(http);
        boolean rh = role == Role.RH;
        return service.get(id, GatewayHeaders.requireUserId(http), rh);
    }

    @PostMapping(value = "/{id}/approve", produces = MediaType.APPLICATION_JSON_VALUE)
    public EmployeeExpenseClaimResponse approve(HttpServletRequest http, @PathVariable Long id) {
        requireRh(http);
        return service.approve(id, GatewayHeaders.requireUserId(http));
    }

    @PostMapping(value = "/{id}/reject", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public EmployeeExpenseClaimResponse reject(
        HttpServletRequest http,
        @PathVariable Long id,
        @RequestBody RejectExpenseClaimRequest request
    ) {
        requireRh(http);
        return service.reject(id, GatewayHeaders.requireUserId(http), request);
    }

    @PostMapping(value = "/{id}/reimburse", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public EmployeeExpenseClaimResponse reimburse(
        HttpServletRequest http,
        @PathVariable Long id,
        @ModelAttribute ReimburseExpenseClaimRequest request,
        @RequestParam(required = false) MultipartFile proof
    ) {
        requireRh(http);
        return service.reimburse(id, request, proof);
    }

    private static void requireRh(HttpServletRequest http) {
        if (GatewayHeaders.requireRole(http) != Role.RH) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Acces RH requis");
        }
    }

    private static void requireEmployeeOrManager(HttpServletRequest http) {
        Role role = GatewayHeaders.requireRole(http);
        if (role != Role.EMPLOYEE && role != Role.MANAGER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Acces salarie requis");
        }
    }
}
