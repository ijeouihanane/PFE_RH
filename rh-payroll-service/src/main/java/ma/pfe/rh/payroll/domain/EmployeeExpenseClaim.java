package ma.pfe.rh.payroll.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "employee_expense_claims")
public class EmployeeExpenseClaim {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "employee_id", nullable = false)
    private Long employeeId;

    @Column(name = "employee_first_name", length = 100)
    private String employeeFirstName;

    @Column(name = "employee_last_name", length = 100)
    private String employeeLastName;

    @Column(nullable = false, length = 150)
    private String motif;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private EmployeeExpenseCategory categorie;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal montant;

    @Column(name = "date_heure", nullable = false)
    private LocalDateTime dateHeure;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Column(name = "justificatif_url", nullable = false)
    private String justificatifUrl;

    @Column(name = "justificatif_original_name", nullable = false)
    private String justificatifOriginalName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private EmployeeExpenseClaimStatus status = EmployeeExpenseClaimStatus.SOUMIS;

    @Column(name = "refusal_reason", columnDefinition = "TEXT")
    private String refusalReason;

    @Column(name = "submitted_at", nullable = false)
    private Instant submittedAt;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "reviewed_by")
    private Long reviewedBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "reimbursement_mode", length = 20)
    private ReimbursementMode reimbursementMode;

    @Column(name = "reimbursed_at")
    private LocalDate reimbursedAt;

    @Column(name = "reimbursement_note", columnDefinition = "TEXT")
    private String reimbursementNote;

    @Column(name = "reimbursement_proof_url")
    private String reimbursementProofUrl;

    @Column(name = "reimbursement_proof_original_name")
    private String reimbursementProofOriginalName;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;
}
