package ma.pfe.rh.payroll.dto;

import java.math.BigDecimal;

public record EmployeeExpenseClaimSummaryResponse(
    BigDecimal totalSubmitted,
    BigDecimal pendingAmount,
    BigDecimal approvedAmount,
    BigDecimal reimbursedAmount,
    long pendingCount,
    long requestCount
) {
}
