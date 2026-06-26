package ma.pfe.rh.payroll.web;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import ma.pfe.rh.payroll.dto.ExpenseRequest;
import ma.pfe.rh.payroll.dto.ExpenseResponse;
import ma.pfe.rh.payroll.dto.ExpenseSummaryResponse;
import ma.pfe.rh.payroll.service.ExpenseService;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/expenses")
@RequiredArgsConstructor
public class ExpenseController {

    private final ExpenseService expenseService;

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public List<ExpenseResponse> list(HttpServletRequest http) {
        requireRh(http);
        return expenseService.list();
    }

    @GetMapping(value = "/summary", produces = MediaType.APPLICATION_JSON_VALUE)
    public ExpenseSummaryResponse summary(HttpServletRequest http) {
        requireRh(http);
        return expenseService.summary();
    }

    @GetMapping(value = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ExpenseResponse get(HttpServletRequest http, @PathVariable Long id) {
        requireRh(http);
        return expenseService.get(id);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ExpenseResponse> create(
        HttpServletRequest http,
        @ModelAttribute ExpenseRequest request,
        @RequestParam(required = false) MultipartFile justificatif
    ) {
        requireRh(http);
        return ResponseEntity.status(HttpStatus.CREATED).body(expenseService.create(request, justificatif));
    }

    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ExpenseResponse update(
        HttpServletRequest http,
        @PathVariable Long id,
        @ModelAttribute ExpenseRequest request,
        @RequestParam(required = false) MultipartFile justificatif
    ) {
        requireRh(http);
        return expenseService.update(id, request, justificatif);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(HttpServletRequest http, @PathVariable Long id) {
        requireRh(http);
        expenseService.delete(id);
        return ResponseEntity.noContent().build();
    }

    private static void requireRh(HttpServletRequest http) {
        if (GatewayHeaders.requireRole(http) != Role.RH) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Acces RH requis");
        }
    }
}
