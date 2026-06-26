package ma.pfe.rh.timesheets.dto;

import lombok.Builder;
import lombok.Value;

import java.time.LocalDate;

@Value
@Builder
public class TimesheetDayInfo {
    LocalDate date;
    boolean workingDay;
    boolean weekend;
    String holidayName;
    String leaveType;
}
