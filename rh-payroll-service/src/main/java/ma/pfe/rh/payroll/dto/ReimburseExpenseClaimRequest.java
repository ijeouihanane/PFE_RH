package ma.pfe.rh.payroll.dto;

import ma.pfe.rh.payroll.domain.ReimbursementMode;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;

public record ReimburseExpenseClaimRequest(
    ReimbursementMode reimbursementMode,
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    LocalDate reimbursedAt,
    String reimbursementNote
) {
}
