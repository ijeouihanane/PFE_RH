package ma.pfe.rh.users.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import ma.pfe.rh.users.domain.AppraisalCriterionLevel;

@Data
public class AppraisalCriterionAnswerRequest {
    @NotNull
    private Long criterionId;

    @NotNull
    private AppraisalCriterionLevel level;

    private String comment;
}
