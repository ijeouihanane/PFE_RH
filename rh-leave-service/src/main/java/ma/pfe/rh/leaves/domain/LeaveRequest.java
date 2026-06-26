package ma.pfe.rh.leaves.domain;

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

import java.time.Instant;
import java.time.LocalDate;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "leave_requests")
public class LeaveRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "employee_id", nullable = false)
    private Long employeeId;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_conge", nullable = false)
    private LeaveType typeConge;

    @Column(name = "date_debut", nullable = false)
    private LocalDate dateDebut;

    @Column(name = "date_fin", nullable = false)
    private LocalDate dateFin;

    @Column(name = "nb_jours", nullable = false)
    private int nbJours;

    @Column(name = "jours_calendaires")
    private int joursCalendaires;

    @Column(name = "weekends_exclus")
    private int weekendsExclus;

    @Column(name = "jours_feries_exclus")
    private int joursFeriesExclus;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LeaveStatus statut;

    @Column(length = 2000)
    private String motif;

    @Column(name = "commentaire_manager", length = 2000)
    private String commentaireManager;

    @Column(name = "commentaire_rh", length = 2000)
    private String commentaireRh;

    @Column(name = "manager_id")
    private Long managerId;

    @Column(name = "rh_id")
    private Long rhId;

    @Column(name = "justificatif_url", length = 1000)
    private String justificatifUrl;

    @Column(name = "justificatif_name", length = 255)
    private String justificatifName;

    @Column(name = "justificatif_type", length = 120)
    private String justificatifType;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "cancelled_by")
    private Long cancelledBy;

    @Column(name = "cancel_reason", length = 2000)
    private String cancelReason;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
