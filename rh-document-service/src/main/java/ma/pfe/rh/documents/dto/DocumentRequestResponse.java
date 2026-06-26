package ma.pfe.rh.documents.dto;

import lombok.Builder;
import lombok.Value;
import ma.pfe.rh.documents.domain.DocumentRequestEntity;
import ma.pfe.rh.documents.domain.DocumentRequestStatus;
import ma.pfe.rh.documents.domain.DocumentRequestType;

import java.time.Instant;

@Value
@Builder
public class DocumentRequestResponse {
    Long id;
    Long employeeId;
    DocumentRequestType typeDoc;
    DocumentRequestStatus statut;
    String fichierUrl;
    Instant createdAt;
    Instant processedAt;
    Long processedBy;
    Integer mois;
    Integer annee;
    String commentaireDemande;
    String commentaire;

    public static DocumentRequestResponse from(DocumentRequestEntity e) {
        return DocumentRequestResponse.builder()
                .id(e.getId())
                .employeeId(e.getEmployeeId())
                .typeDoc(e.getTypeDoc())
                .statut(e.getStatut())
                .fichierUrl(e.getFichierUrl())
                .createdAt(e.getCreatedAt())
                .processedAt(e.getProcessedAt())
                .processedBy(e.getProcessedBy())
                .mois(e.getMois())
                .annee(e.getAnnee())
                .commentaireDemande(e.getCommentaireDemande())
                .commentaire(e.getCommentaire())
                .build();
    }
}
