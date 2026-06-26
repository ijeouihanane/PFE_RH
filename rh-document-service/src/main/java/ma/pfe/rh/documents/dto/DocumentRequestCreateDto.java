package ma.pfe.rh.documents.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import ma.pfe.rh.documents.domain.DocumentRequestType;

@Data
public class DocumentRequestCreateDto {

    @NotNull
    private DocumentRequestType typeDoc;

    private Integer mois;

    private Integer annee;

    private String commentaireDemande;
}
