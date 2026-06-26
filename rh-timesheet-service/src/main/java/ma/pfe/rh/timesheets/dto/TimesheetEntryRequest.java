package ma.pfe.rh.timesheets.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class TimesheetEntryRequest {

    @NotNull(message = "La date du jour est obligatoire")
    private LocalDate dateJour;

    private String entryType;
    private String workMode;
    private String absenceType;
    private java.math.BigDecimal nbHeures;
    private Integer retardMinutes;
    private Long projectId;
    private String description;
}
