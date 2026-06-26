package ma.pfe.rh.timesheets.dto;

import lombok.Builder;
import lombok.Value;
import ma.pfe.rh.timesheets.domain.Timesheet;
import ma.pfe.rh.timesheets.domain.TimesheetStatus;

import java.time.LocalDate;
import java.util.List;

@Value
@Builder(toBuilder = true)
public class TimesheetResponse {
    Long id;
    Long employeeId;
    LocalDate semaineDebut;
    TimesheetStatus statut;
    String commentaireManager;
    double totalHeures;
    Long managerId;
    String employeeName;
    String employeeMatricule;
    String employeeDepartment;
    String managerName;
    Long validatorId;
    String validatorName;
    int expectedHours;
    int holidayDays;
    int leaveDays;
    String faitsMarquants;
    String risquesBlocages;
    String planSemaineProchaine;
    String suggestionsAmeliorations;
    List<TimesheetEntryResponse> entries;
    List<TimesheetDeliverableResponse> deliverables;
    List<TimesheetEventResponse> events;
    List<TimesheetDayInfo> days;
    java.util.Map<String, String> holidays;

    public static TimesheetResponse from(Timesheet t) {
        return from(t, null);
    }

    public static TimesheetResponse from(Timesheet t, Long managerId) {
        double total = (t.getEntries() == null) ? 0.0 : t.getEntries().stream()
                .mapToDouble(e -> e.getNbHeures() != null ? e.getNbHeures().doubleValue() : 0.0)
                .sum();
        return TimesheetResponse.builder()
                .id(t.getId())
                .employeeId(t.getEmployeeId())
                .semaineDebut(t.getSemaineDebut())
                .statut(t.getStatut())
                .commentaireManager(t.getCommentaireManager())
                .totalHeures(total)
                .managerId(managerId)
                .entries(t.getEntries() != null ? t.getEntries().stream().map(TimesheetEntryResponse::from).toList() : List.of())
                .deliverables(t.getDeliverables() != null ? t.getDeliverables().stream().map(TimesheetDeliverableResponse::from).toList() : List.of())
                .events(t.getEvents() != null ? t.getEvents().stream().map(TimesheetEventResponse::from).toList() : List.of())
                .days(List.of())
                .holidays(new java.util.HashMap<>())
                .faitsMarquants(t.getFaitsMarquants())
                .risquesBlocages(t.getRisquesBlocages())
                .planSemaineProchaine(t.getPlanSemaineProchaine())
                .suggestionsAmeliorations(t.getSuggestionsAmeliorations())
                .build();
    }
}
