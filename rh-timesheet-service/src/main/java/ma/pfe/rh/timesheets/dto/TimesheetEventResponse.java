package ma.pfe.rh.timesheets.dto;

import lombok.Builder;
import lombok.Value;
import ma.pfe.rh.timesheets.domain.TimesheetEvent;

import java.time.Instant;

@Value
@Builder
public class TimesheetEventResponse {
    String action;
    Long actorId;
    String comment;
    Instant createdAt;

    public static TimesheetEventResponse from(TimesheetEvent e) {
        return TimesheetEventResponse.builder()
                .action(e.getAction())
                .actorId(e.getActorId())
                .comment(e.getComment())
                .createdAt(e.getCreatedAt())
                .build();
    }
}
