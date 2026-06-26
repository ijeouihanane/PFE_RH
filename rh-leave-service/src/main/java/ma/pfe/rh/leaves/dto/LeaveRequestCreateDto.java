package ma.pfe.rh.leaves.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import ma.pfe.rh.leaves.domain.LeaveType;

import java.time.LocalDate;

@Data
public class LeaveRequestCreateDto {

    @NotNull
    private LeaveType typeConge;

    @NotNull
    private LocalDate dateDebut;

    @NotNull
    private LocalDate dateFin;

    private String motif;

    private String justificatifName;

    private String justificatifUrl;

    private String justificatifType;
}
