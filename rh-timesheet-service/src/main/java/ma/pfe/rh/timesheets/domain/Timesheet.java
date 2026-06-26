package ma.pfe.rh.timesheets.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "timesheets")
public class Timesheet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "employee_id", nullable = false)
    private Long employeeId;

    @Column(name = "semaine_debut", nullable = false)
    private LocalDate semaineDebut;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TimesheetStatus statut;

    @Column(name = "commentaire_manager", length = 2000)
    private String commentaireManager;

    @Lob
    @Column(name = "faits_marquants", columnDefinition = "TEXT")
    private String faitsMarquants;

    @Lob
    @Column(name = "risques_blocages", columnDefinition = "TEXT")
    private String risquesBlocages;

    @Lob
    @Column(name = "plan_semaine_prochaine", columnDefinition = "TEXT")
    private String planSemaineProchaine;

    @Lob
    @Column(name = "suggestions_ameliorations", columnDefinition = "TEXT")
    private String suggestionsAmeliorations;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "validated_at")
    private Instant validatedAt;

    @Column(name = "validated_by")
    private Long validatedBy;

    @Column(name = "rejected_at")
    private Instant rejectedAt;

    @Column(name = "rejected_by")
    private Long rejectedBy;

    @OneToMany(mappedBy = "timesheet", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<TimesheetEntry> entries = new ArrayList<>();

    @OneToMany(mappedBy = "timesheet", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<TimesheetDeliverable> deliverables = new ArrayList<>();

    @OneToMany(mappedBy = "timesheet", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<TimesheetEvent> events = new ArrayList<>();
}
