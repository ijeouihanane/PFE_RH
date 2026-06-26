package ma.pfe.rh.timesheets.dto;

import lombok.Builder;
import lombok.Value;
import ma.pfe.rh.timesheets.domain.TimesheetEntry;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

@Value
@Builder
public class TimesheetEntryResponse {
    Long id;
    LocalDate dateJour;
    BigDecimal nbHeures;
    String description;
    String entryType;
    String workMode;
    String absenceType;
    Integer retardMinutes;
    Long projectId;
    String projectName;

    public static TimesheetEntryResponse from(TimesheetEntry e) {
        return from(e, null);
    }

    public static TimesheetEntryResponse from(TimesheetEntry e, String projectName) {
        return TimesheetEntryResponse.builder()
                .id(e.getId())
                .dateJour(e.getDateJour())
                .nbHeures(e.getNbHeures())
                .description(e.getDescription())
                .entryType(e.getEntryType() != null ? e.getEntryType().name() : null)
                .workMode(e.getWorkMode() != null ? e.getWorkMode().name() : null)
                .absenceType(e.getAbsenceType() != null ? e.getAbsenceType().name() : null)
                .retardMinutes(e.getRetardMinutes())
                .projectId(e.getProjectId())
                .projectName(projectName)
                .build();
    }
}
