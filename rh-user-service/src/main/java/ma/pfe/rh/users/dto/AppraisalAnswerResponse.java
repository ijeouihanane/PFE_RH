package ma.pfe.rh.users.dto;

import lombok.Builder;
import lombok.Value;
import ma.pfe.rh.users.domain.AppraisalCriterionLevel;

@Value
@Builder
public class AppraisalAnswerResponse {
    Long criterionId;
    String criterionLabel;
    String criterionDescription;
    int displayOrder;
    AppraisalCriterionLevel level;
    String comment;
}
