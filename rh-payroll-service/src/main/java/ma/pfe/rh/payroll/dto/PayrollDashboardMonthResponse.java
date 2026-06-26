package ma.pfe.rh.payroll.dto;

import java.math.BigDecimal;

public record PayrollDashboardMonthResponse(
    String label,
    int month,
    int year,
    BigDecimal netPayroll,
    BigDecimal rhExpenses,
    BigDecimal reimbursedClaims,
    BigDecimal socialCharges,
    BigDecimal totalOutflow
) {
}
