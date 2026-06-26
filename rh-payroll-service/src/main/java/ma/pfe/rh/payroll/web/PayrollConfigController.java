package ma.pfe.rh.payroll.web;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import ma.pfe.rh.payroll.dto.IncomeTaxBracketDTO;
import ma.pfe.rh.payroll.dto.PayrollParameterDTO;
import ma.pfe.rh.payroll.dto.PayrollProfileDTO;
import ma.pfe.rh.payroll.dto.SeniorityRuleDTO;
import ma.pfe.rh.payroll.dto.SimulateRequest;
import ma.pfe.rh.payroll.dto.SimulateResponse;
import ma.pfe.rh.payroll.service.PayrollCalculationService;
import ma.pfe.rh.payroll.service.PayrollParameterService;
import ma.pfe.rh.payroll.service.PayrollProfileService;
import ma.pfe.rh.payroll.web.security.Role;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/payroll")
@RequiredArgsConstructor
public class PayrollConfigController {

    private final PayrollProfileService profileService;
    private final PayrollParameterService parameterService;
    private final PayrollCalculationService calculationService;

    // --- Profils paie ---

    @GetMapping(value = "/profiles/{employeeId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public PayrollProfileDTO getProfile(HttpServletRequest http, @PathVariable Long employeeId) {
        requireRh(http);
        return profileService.getByEmployeeId(employeeId);
    }

    @PutMapping(value = "/profiles/{employeeId}", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public PayrollProfileDTO updateProfile(HttpServletRequest http, @PathVariable Long employeeId, @RequestBody PayrollProfileDTO dto) {
        requireRh(http);
        return profileService.createOrUpdate(employeeId, dto);
    }

    // --- Paramètres globaux ---

    @GetMapping(value = "/parameters", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<PayrollParameterDTO> getParameters(HttpServletRequest http) {
        requireRh(http);
        return parameterService.getAllParameters();
    }

    @PutMapping(value = "/parameters", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public List<PayrollParameterDTO> updateParameters(HttpServletRequest http, @RequestBody List<PayrollParameterDTO> dtos) {
        requireRh(http);
        return parameterService.updateParameters(dtos);
    }

    // --- Tranches IR ---

    @GetMapping(value = "/tax-brackets", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<IncomeTaxBracketDTO> getTaxBrackets(HttpServletRequest http) {
        requireRh(http);
        return parameterService.getAllTaxBrackets();
    }

    @PutMapping(value = "/tax-brackets", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public List<IncomeTaxBracketDTO> updateTaxBrackets(HttpServletRequest http, @RequestBody List<IncomeTaxBracketDTO> dtos) {
        requireRh(http);
        return parameterService.updateTaxBrackets(dtos);
    }

    // --- Règles ancienneté ---

    @GetMapping(value = "/seniority-rules", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<SeniorityRuleDTO> getSeniorityRules(HttpServletRequest http) {
        requireRh(http);
        return parameterService.getAllSeniorityRules();
    }

    @PutMapping(value = "/seniority-rules", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public List<SeniorityRuleDTO> updateSeniorityRules(HttpServletRequest http, @RequestBody List<SeniorityRuleDTO> dtos) {
        requireRh(http);
        return parameterService.updateSeniorityRules(dtos);
    }

    // --- Simulation ---

    @PostMapping(value = "/payslips/simulate", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public SimulateResponse simulate(HttpServletRequest http, @RequestBody SimulateRequest request) {
        requireRh(http);
        return calculationService.simulate(request);
    }

    // --- Sécurité ---

    private static void requireRh(HttpServletRequest http) {
        if (GatewayHeaders.requireRole(http) != Role.RH) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Accès RH requis");
        }
    }
}
