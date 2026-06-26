package ma.pfe.rh.documents.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import ma.pfe.rh.documents.domain.DocType;

@Data
public class DocumentCreateDto {

    @NotBlank
    private String titre;

    @NotNull
    private DocType type;

    @NotBlank
    private String contenu;

    private String categorie;

    private Boolean epinglee;
}
