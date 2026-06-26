package ma.pfe.rh.users.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.FetchType;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Lob;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "appraisals")
public class Appraisal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "employee_id", nullable = false)
    private Long employeeId;

    @Column(name = "manager_id", nullable = false)
    private Long managerId;

    @Column(nullable = false)
    private String periode;

    @Column(name = "objectifs_note", nullable = false)
    private int objectifsNote;

    @Column(name = "competences_note", nullable = false)
    private int competencesNote;

    @Column(name = "comportement_note", nullable = false)
    private int comportementNote;

    @Column(nullable = false, length = 4000)
    private String commentaire;

    @Column(name = "axes_amelioration", length = 4000)
    private String axesAmelioration;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "grid_template_id")
    private AppraisalGridTemplate gridTemplate;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private AppraisalPerformance performance;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private AppraisalPotential potential;

    @Column(name = "positioning_category", length = 120)
    private String positioningCategory;

    @Lob
    @Column(name = "generated_summary", columnDefinition = "TEXT")
    private String generatedSummary;

    @Lob
    @Column(name = "manager_comment", columnDefinition = "TEXT")
    private String managerComment;

    @Lob
    @Column(name = "employee_comment", columnDefinition = "TEXT")
    private String employeeComment;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40, columnDefinition = "varchar(40)")
    private AppraisalStatus statut;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "employee_acknowledged_at")
    private Instant employeeAcknowledgedAt;

    @Column(name = "rh_validated_at")
    private Instant rhValidatedAt;

    @Builder.Default
    @OneToMany(mappedBy = "appraisal", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<AppraisalCriterionResponse> criterionResponses = new ArrayList<>();
}
