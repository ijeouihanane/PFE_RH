package ma.pfe.rh.documents.dto;

import lombok.Builder;
import lombok.Value;
import ma.pfe.rh.documents.domain.DocType;
import ma.pfe.rh.documents.domain.DocumentEntity;

import java.time.Instant;

@Value
@Builder
public class DocumentResponse {
    Long id;
    String titre;
    DocType type;
    String contenu;
    String fichierUrl;
    String categorie;
    Long publiePar;
    Instant publieAt;
    boolean actif;
    boolean epinglee;

    public static DocumentResponse from(DocumentEntity d) {
        return DocumentResponse.builder()
                .id(d.getId())
                .titre(d.getTitre())
                .type(d.getType())
                .contenu(d.getContenu())
                .fichierUrl(d.getFichierUrl())
                .categorie(d.getCategorie())
                .publiePar(d.getPubliePar())
                .publieAt(d.getPublieAt())
                .actif(d.isActif())
                .epinglee(d.isEpinglee())
                .build();
    }
}
