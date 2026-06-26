package ma.pfe.rh.payroll.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(
    name = "payslips",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_payslip_emp_month_year",
        columnNames = {"employee_id", "mois", "annee"}
    )
)
public class Payslip {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "employee_id", nullable = false)
    private Long employeeId;

    @Column(nullable = false)
    private int mois;

    @Column(nullable = false)
    private int annee;

    // Compatibilité avec l'ancien upload PDF
    @Column(name = "fichier_url")
    private String fichierUrl;

    @Column(name = "uploaded_by")
    private Long uploadedBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    // --- Champs Lot 3 ---

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private PayslipStatus status = PayslipStatus.DRAFT;

    // Montants calculés
    @Column(name = "base_salary", precision = 12, scale = 2)
    private BigDecimal baseSalary;

    @Column(name = "fixed_bonus", precision = 12, scale = 2)
    private BigDecimal fixedBonus;

    @Column(name = "seniority_bonus", precision = 12, scale = 2)
    private BigDecimal seniorityBonus;

    @Column(name = "gross_salary", precision = 12, scale = 2)
    private BigDecimal grossSalary;

    @Column(name = "cnss_amount", precision = 12, scale = 2)
    private BigDecimal cnssAmount;

    @Column(name = "amo_amount", precision = 12, scale = 2)
    private BigDecimal amoAmount;

    @Column(name = "taxable_net", precision = 12, scale = 2)
    private BigDecimal taxableNet;

    @Column(name = "ir_amount", precision = 12, scale = 2)
    private BigDecimal irAmount;

    @Column(name = "net_pay", precision = 12, scale = 2)
    private BigDecimal netPay;

    @Column(name = "pdf_url")
    private String pdfUrl;

    @Column(name = "validated_by")
    private Long validatedBy;

    @Column(name = "validated_at")
    private Instant validatedAt;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    // --- Snapshot employé ---

    @Column(name = "employee_first_name", length = 100)
    private String employeeFirstName;

    @Column(name = "employee_last_name", length = 100)
    private String employeeLastName;

    @Column(name = "employee_matricule", length = 50)
    private String employeeMatricule;

    @Column(name = "employee_poste", length = 100)
    private String employeePoste;

    @Column(name = "employee_departement", length = 100)
    private String employeeDepartement;

    @Column(name = "employee_cnss", length = 50)
    private String employeeCnss;

    @Column(name = "employee_rib", length = 50)
    private String employeeRib;

    @Column(name = "employee_bank_name", length = 100)
    private String employeeBankName;

    @Column(name = "employee_hire_date")
    private LocalDate employeeHireDate;
}
