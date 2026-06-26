package ma.pfe.rh.leaves.dto;

import lombok.Builder;
import lombok.Value;
import ma.pfe.rh.leaves.domain.LeaveRequest;
import ma.pfe.rh.leaves.domain.LeaveStatus;
import ma.pfe.rh.leaves.domain.LeaveType;

import java.time.Instant;
import java.time.LocalDate;

@Value
@Builder
public class LeaveRequestResponse {
    Long id;
    Long employeeId;
    LeaveType typeConge;
    LocalDate dateDebut;
    LocalDate dateFin;
    int nbJours;
    int joursCalendaires;
    int weekendsExclus;
    int joursFeriesExclus;
    LeaveStatus statut;
    String motif;
    String commentaireManager;
    String commentaireRh;
    Long managerId;
    Long rhId;
    String justificatifUrl;
    String justificatifName;
    String justificatifType;
    Instant cancelledAt;
    Long cancelledBy;
    String cancelReason;
    Instant createdAt;
    Instant updatedAt;

    public static LeaveRequestResponse from(LeaveRequest r) {
        return LeaveRequestResponse.builder()
                .id(r.getId())
                .employeeId(r.getEmployeeId())
                .typeConge(r.getTypeConge())
                .dateDebut(r.getDateDebut())
                .dateFin(r.getDateFin())
                .nbJours(r.getNbJours())
                .joursCalendaires(r.getJoursCalendaires())
                .weekendsExclus(r.getWeekendsExclus())
                .joursFeriesExclus(r.getJoursFeriesExclus())
                .statut(r.getStatut())
                .motif(r.getMotif())
                .commentaireManager(r.getCommentaireManager())
                .commentaireRh(r.getCommentaireRh())
                .managerId(r.getManagerId())
                .rhId(r.getRhId())
                .justificatifUrl(r.getJustificatifUrl())
                .justificatifName(r.getJustificatifName())
                .justificatifType(r.getJustificatifType())
                .cancelledAt(r.getCancelledAt())
                .cancelledBy(r.getCancelledBy())
                .cancelReason(r.getCancelReason())
                .createdAt(r.getCreatedAt())
                .updatedAt(r.getUpdatedAt())
                .build();
    }
}
