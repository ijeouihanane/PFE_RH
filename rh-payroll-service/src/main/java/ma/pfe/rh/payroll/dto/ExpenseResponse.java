package ma.pfe.rh.payroll.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;

public record ExpenseResponse(
    Long id,
    String motif,
    BigDecimal montant,
    LocalDateTime dateHeure,
    String note,
    String justificatifUrl,
    String justificatifOriginalName,
    Instant createdAt,
    Instant updatedAt
) {
}
