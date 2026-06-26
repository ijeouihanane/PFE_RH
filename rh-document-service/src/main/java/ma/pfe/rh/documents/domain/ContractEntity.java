package ma.pfe.rh.documents.domain;

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

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "employee_contracts")
public class ContractEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ── Référence employé ─────────────────────────────────────────────────────
    @Column(name = "employee_id", nullable = false)
    private Long employeeId;

    // Snapshot employé : évite les appels /api/users pour la liste, l'aperçu et le PDF
    @Column(name = "employee_full_name")
    private String employeeFullName;

    @Column(name = "employee_matricule")
    private String employeeMatricule;

    @Column(name = "employee_cin")
    private String employeeCin;

    @Column(name = "employee_poste")
    private String employeePoste;

    @Column(name = "employee_departement")
    private String employeeDepartement;

    @Column(name = "employee_email")
    private String employeeEmail;

    @Column(name = "employee_hire_date")
    private LocalDate employeeHireDate;

    // ── Type et statut ────────────────────────────────────────────────────────
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private ContractType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private ContractStatus status = ContractStatus.BROUILLON;

    // ── Données du contrat ────────────────────────────────────────────────────
    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    /** Null pour CDI */
    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "workplace")
    private String workplace;

    @Column(name = "signature_place")
    private String signaturePlace;

    @Column(name = "signature_date")
    private LocalDate signatureDate;

    @Column(name = "trial_period")
    private String trialPeriod;

    @Column(name = "notice_period")
    private String noticePeriod;

    // ── Rémunération ──────────────────────────────────────────────────────────
    @Column(name = "base_salary", precision = 12, scale = 2)
    private BigDecimal baseSalary;

    @Column(name = "fixed_bonus", precision = 12, scale = 2)
    private BigDecimal fixedBonus;

    // ── Données formulaire et clauses ─────────────────────────────────────────
    /** JSON complémentaire (réservé pour extensions futures) */
    @Column(name = "form_data_json", columnDefinition = "TEXT")
    private String formDataJson;

    /** JSON : map articleId → contenu HTML Quill édité par le RH */
    @Column(name = "clauses_json", columnDefinition = "LONGTEXT")
    private String clausesJson;

    // ── PDF généré ────────────────────────────────────────────────────────────
    /** Snapshot HTML complet après rendu Thymeleaf (immuable une fois généré) */
    @Column(name = "rendered_html", columnDefinition = "LONGTEXT")
    private String renderedHtml;

    /** Chemin relatif du PDF : /uploads/contracts/{employeeId}/{id}/contrat.pdf */
    @Column(name = "pdf_url")
    private String pdfUrl;

    // ── Audit ─────────────────────────────────────────────────────────────────
    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "generated_at")
    private Instant generatedAt;
}
