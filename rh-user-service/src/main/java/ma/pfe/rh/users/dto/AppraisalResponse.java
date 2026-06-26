package ma.pfe.rh.users.dto;

import lombok.Builder;
import lombok.Value;
import ma.pfe.rh.users.domain.AppraisalPerformance;
import ma.pfe.rh.users.domain.AppraisalPotential;
import ma.pfe.rh.users.domain.AppraisalStatus;

import java.time.Instant;
import java.util.List;

@Value
@Builder
public class AppraisalResponse {
    Long id;
    Long employeeId;
    Long managerId;
    String employeeName;
    String managerName;
    String employeeDepartment;
    String employeePoste;
    String periode;
    Long gridTemplateId;
    String gridLabel;
    AppraisalPerformance performance;
    AppraisalPotential potential;
    String positioningCategory;
    String generatedSummary;
    String managerComment;
    String employeeComment;
    AppraisalStatus statut;
    Instant createdAt;
    Instant updatedAt;
    Instant submittedAt;
    Instant employeeAcknowledgedAt;
    Instant rhValidatedAt;
    List<AppraisalAnswerResponse> answers;
}
