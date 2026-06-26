package ma.pfe.rh.leaves.dto;

import lombok.Builder;
import lombok.Value;
import ma.pfe.rh.leaves.domain.LeaveBalance;

@Value
@Builder
public class LeaveBalanceResponse {
    Long id;
    Long employeeId;
    int annee;
    int soldeAnnuel;
    int joursUtilises;
    int joursRestants;

    public static LeaveBalanceResponse from(LeaveBalance b) {
        return LeaveBalanceResponse.builder()
                .id(b.getId())
                .employeeId(b.getEmployeeId())
                .annee(b.getAnnee())
                .soldeAnnuel(b.getSoldeAnnuel())
                .joursUtilises(b.getJoursUtilises())
                .joursRestants(b.getJoursRestants())
                .build();
    }
}
