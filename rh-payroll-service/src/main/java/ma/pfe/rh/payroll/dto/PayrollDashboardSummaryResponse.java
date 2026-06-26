package ma.pfe.rh.payroll.dto;

import java.math.BigDecimal;
import java.util.List;

public record PayrollDashboardSummaryResponse(
    int month,
    int year,
    BigDecimal netPayroll,
    BigDecimal grossPayroll,
    BigDecimal socialCharges,
    BigDecimal rhExpenses,
    BigDecimal reimbursedClaims,
    BigDecimal pendingReimbursement,
    BigDecimal totalOutflow,
    long generatedPayslipCount,
    long pendingReimbursementCount,
    List<PayrollDashboardMonthResponse> monthlyOutflows
) {
}
