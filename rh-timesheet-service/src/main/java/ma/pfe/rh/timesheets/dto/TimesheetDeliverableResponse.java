package ma.pfe.rh.timesheets.dto;

import lombok.Builder;
import lombok.Value;
import ma.pfe.rh.timesheets.domain.TimesheetDeliverable;

@Value
@Builder
public class TimesheetDeliverableResponse {
    Long id;
    String label;
    String url;

    public static TimesheetDeliverableResponse from(TimesheetDeliverable d) {
        return TimesheetDeliverableResponse.builder()
                .id(d.getId())
                .label(d.getLabel())
                .url(d.getUrl())
                .build();
    }
}
