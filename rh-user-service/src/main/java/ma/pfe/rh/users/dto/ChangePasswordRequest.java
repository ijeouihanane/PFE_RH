package ma.pfe.rh.users.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ChangePasswordRequest {

    @NotBlank
    private String ancienMotDePasse;

    @NotBlank
    private String nouveauMotDePasse;
}
