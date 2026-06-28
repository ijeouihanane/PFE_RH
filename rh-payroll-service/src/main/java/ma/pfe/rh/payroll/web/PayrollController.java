package ma.pfe.rh.payroll.web;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import ma.pfe.rh.payroll.dto.BatchGenerateRequest;
import ma.pfe.rh.payroll.dto.BatchGenerateResponse;
import ma.pfe.rh.payroll.dto.BatchSimulateRequest;
import ma.pfe.rh.payroll.dto.BatchSimulateResponse;
import ma.pfe.rh.payroll.dto.PayrollDashboardSummaryResponse;
import ma.pfe.rh.payroll.dto.PayslipResponse;
import ma.pfe.rh.payroll.dto.PayslipSaveRequest;
import ma.pfe.rh.payroll.service.PayrollDashboardService;
import ma.pfe.rh.payroll.service.PayrollService;
import ma.pfe.rh.payroll.web.security.Role;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/payroll")
@RequiredArgsConstructor
public class PayrollController {

    private final PayrollService payrollService;
    private final PayrollDashboardService payrollDashboardService;

    @GetMapping(value = "/dashboard/rh", produces = MediaType.APPLICATION_JSON_VALUE)
    public PayrollDashboardSummaryResponse rhDashboard(
            HttpServletRequest http,
            @RequestParam int month,
            @RequestParam int year
    ) {
        requireRh(http);
        return payrollDashboardService.rhSummary(month, year);
    }

    // ---- Employé : mes bulletins ----

    @GetMapping(value = "/my-payslips", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<PayslipResponse> myPayslips(HttpServletRequest http) {
        return payrollService.payslipsForEmployee(GatewayHeaders.requireUserId(http));
    }

    // ---- RH : historique d'un employé (inclut DRAFT) ----

    @GetMapping(value = "/employees/{employeeId}/payslips", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<PayslipResponse> employeePayslips(HttpServletRequest http, @PathVariable long employeeId) {
        requireRh(http);
        return payrollService.payslipsForRh(employeeId);
    }

    // ---- Ancien upload PDF (inchangé) ----

    @GetMapping(value = "/payslips/history", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<PayslipResponse> payslipsHistoryByPeriod(
            HttpServletRequest http,
            @RequestParam int mois,
            @RequestParam int annee
    ) {
        requireRh(http);
        return payrollService.payslipsForRhPeriod(mois, annee);
    }

    @PostMapping(value = "/employees/{employeeId}/payslips", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public PayslipResponse uploadPayslip(
            HttpServletRequest http,
            @PathVariable long employeeId,
            @RequestParam int mois,
            @RequestParam int annee,
            MultipartFile file
    ) throws Exception {
        requireRh(http);
        return payrollService.uploadPayslip(GatewayHeaders.requireUserId(http), employeeId, mois, annee, file);
    }

    // ---- Lot 3 : Créer ou mettre à jour un DRAFT ----

    @PostMapping(value = "/payslips", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<PayslipResponse> createOrUpdateDraft(
            HttpServletRequest http,
            @RequestBody PayslipSaveRequest req
    ) {
        requireRh(http);
        PayslipResponse response = payrollService.createOrUpdateDraft(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // ---- Lot 3 : Détail d'un bulletin par ID ----

    @GetMapping(value = "/payslips/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public PayslipResponse getPayslip(HttpServletRequest http, @PathVariable long id) {
        requireRh(http);
        return payrollService.getPayslip(id);
    }

    // ---- Lot 4 : Valider un bulletin + générer PDF ----

    @PostMapping(value = "/payslips/{id}/validate", produces = MediaType.APPLICATION_JSON_VALUE)
    public PayslipResponse validatePayslip(HttpServletRequest http, @PathVariable long id) throws Exception {
        requireRh(http);
        return payrollService.validate(id, GatewayHeaders.requireUserId(http));
    }

    // ---- Lot 5 : Envoyer un bulletin à l'employé ----

    @PostMapping(value = "/payslips/{id}/send", produces = MediaType.APPLICATION_JSON_VALUE)
    public PayslipResponse sendPayslip(HttpServletRequest http, @PathVariable long id) {
        requireRh(http);
        return payrollService.send(id);
    }

    // ---- Tâche 3 : Simulation groupée (READ-ONLY) ----

    @PostMapping(value = "/payslips/batch/simulate", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public BatchSimulateResponse batchSimulate(
            HttpServletRequest http,
            @RequestBody BatchSimulateRequest req
    ) {
        requireRh(http);
        return payrollService.batchSimulate(req);
    }

    // ---- Tâche 4 : Génération groupée ----

    @PostMapping(value = "/payslips/batch/generate", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public BatchGenerateResponse batchGenerate(
            HttpServletRequest http,
            @RequestBody BatchGenerateRequest req
    ) {
        requireRh(http);
        return payrollService.batchGenerate(req, GatewayHeaders.requireUserId(http));
    }

    // ---- helper ----

    private static void requireRh(HttpServletRequest http) {
        if (GatewayHeaders.requireRole(http) != Role.RH) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Accès RH requis");
        }
    }
}
