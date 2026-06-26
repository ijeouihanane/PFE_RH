package ma.pfe.rh.users.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class AppraisalContextResponse {
    UserResponse employee;
    String anciennete;
    Long gridTemplateId;
    String gridCode;
    String gridLabel;
    List<AppraisalCriterionDto> criteria;
    PreviousAppraisal previousAppraisal;
    String defaultPeriod;

    @Value
    @Builder
    public static class PreviousAppraisal {
        String periode;
        String positioningCategory;
        String performance;
    }
}
