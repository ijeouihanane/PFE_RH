package ma.pfe.rh.payroll.dto;

import java.math.BigDecimal;

public record ExpenseSummaryResponse(
    BigDecimal total,
    BigDecimal monthTotal,
    long count,
    BigDecimal lastAmount,
    String lastMotif
) {
}
