package ma.pfe.rh.users.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import ma.pfe.rh.users.domain.AppraisalPerformance;
import ma.pfe.rh.users.domain.AppraisalPotential;

import java.util.ArrayList;
import java.util.List;

@Data
public class AppraisalDraftRequest {
    @NotNull
    private Long employeeId;

    @NotBlank
    private String periode;

    private AppraisalPerformance performance;
    private AppraisalPotential potential;
    private String generatedSummary;
    private String managerComment;

    @Valid
    private List<AppraisalCriterionAnswerRequest> answers = new ArrayList<>();
}
