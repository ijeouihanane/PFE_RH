package ma.pfe.rh.documents.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "document_requests")
public class DocumentRequestEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "employee_id", nullable = false)
    private Long employeeId;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_doc", nullable = false)
    private DocumentRequestType typeDoc;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DocumentRequestStatus statut;

    @Column(name = "fichier_url")
    private String fichierUrl;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "processed_at")
    private Instant processedAt;

    @Column(name = "processed_by")
    private Long processedBy;

    private Integer mois;

    private Integer annee;

    @Column(name = "commentaire_demande", length = 1000)
    private String commentaireDemande;

    @Column(length = 1000)
    private String commentaire;
}
