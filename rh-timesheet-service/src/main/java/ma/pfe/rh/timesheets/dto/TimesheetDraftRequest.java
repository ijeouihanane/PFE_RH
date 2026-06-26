package ma.pfe.rh.timesheets.dto;

import lombok.Data;

import java.util.List;

@Data
public class TimesheetDraftRequest {
    private String faitsMarquants;
    private String risquesBlocages;
    private String planSemaineProchaine;
    private String suggestionsAmeliorations;
    private List<TimesheetDeliverableRequest> deliverables;
}
