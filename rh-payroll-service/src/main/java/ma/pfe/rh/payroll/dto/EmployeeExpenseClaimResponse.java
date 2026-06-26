package ma.pfe.rh.payroll.dto;

import ma.pfe.rh.payroll.domain.EmployeeExpenseCategory;
import ma.pfe.rh.payroll.domain.EmployeeExpenseClaimStatus;
import ma.pfe.rh.payroll.domain.ReimbursementMode;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record EmployeeExpenseClaimResponse(
    Long id,
    Long employeeId,
    String employeeFirstName,
    String employeeLastName,
    String employeeLabel,
    String employeeInitials,
    String motif,
    EmployeeExpenseCategory categorie,
    BigDecimal montant,
    LocalDateTime dateHeure,
    String note,
    String justificatifUrl,
    String justificatifOriginalName,
    EmployeeExpenseClaimStatus status,
    String refusalReason,
    Instant submittedAt,
    Instant reviewedAt,
    Long reviewedBy,
    ReimbursementMode reimbursementMode,
    LocalDate reimbursedAt,
    String reimbursementNote,
    String reimbursementProofUrl,
    String reimbursementProofOriginalName,
    Instant createdAt,
    Instant updatedAt
) {
}
