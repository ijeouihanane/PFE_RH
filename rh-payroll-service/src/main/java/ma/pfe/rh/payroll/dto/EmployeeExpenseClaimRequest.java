package ma.pfe.rh.payroll.dto;

import ma.pfe.rh.payroll.domain.EmployeeExpenseCategory;
import org.springframework.format.annotation.DateTimeFormat;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record EmployeeExpenseClaimRequest(
    String employeeFirstName,
    String employeeLastName,
    String motif,
    EmployeeExpenseCategory categorie,
    BigDecimal montant,
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    LocalDateTime dateHeure,
    String note
) {
}
