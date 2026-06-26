package ma.pfe.rh.timesheets.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ProjectRequest {
    @NotBlank
    private String nom;
    private String description;
}
