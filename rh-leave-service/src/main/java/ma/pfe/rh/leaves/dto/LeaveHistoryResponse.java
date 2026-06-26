package ma.pfe.rh.leaves.dto;

import lombok.Builder;
import lombok.Value;
import ma.pfe.rh.leaves.domain.LeaveHistory;
import ma.pfe.rh.leaves.domain.LeaveStatus;

import java.time.Instant;

@Value
@Builder
public class LeaveHistoryResponse {
    Long id;
    Long leaveRequestId;
    Long actorId;
    String actorRole;
    String action;
    LeaveStatus oldStatus;
    LeaveStatus newStatus;
    String commentaire;
    Instant createdAt;

    public static LeaveHistoryResponse from(LeaveHistory h) {
        return LeaveHistoryResponse.builder()
                .id(h.getId())
                .leaveRequestId(h.getLeaveRequestId())
                .actorId(h.getActorId())
                .actorRole(h.getActorRole())
                .action(h.getAction())
                .oldStatus(h.getOldStatus())
                .newStatus(h.getNewStatus())
                .commentaire(h.getCommentaire())
                .createdAt(h.getCreatedAt())
                .build();
    }
}
