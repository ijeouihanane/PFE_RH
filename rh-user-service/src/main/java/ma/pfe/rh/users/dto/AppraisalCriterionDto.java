package ma.pfe.rh.users.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class AppraisalCriterionDto {
    Long id;
    String label;
    String description;
    int displayOrder;
}
