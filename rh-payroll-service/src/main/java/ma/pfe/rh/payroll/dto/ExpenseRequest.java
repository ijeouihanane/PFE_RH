package ma.pfe.rh.payroll.dto;

import org.springframework.format.annotation.DateTimeFormat;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ExpenseRequest(
    String motif,
    BigDecimal montant,
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    LocalDateTime dateHeure,
    String note,
    boolean removeJustificatif
) {
}
