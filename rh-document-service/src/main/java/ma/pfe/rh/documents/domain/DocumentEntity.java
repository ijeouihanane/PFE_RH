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
@Table(name = "documents")
public class DocumentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String titre;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DocType type;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String contenu;

    @Column(name = "fichier_url")
    private String fichierUrl;

    private String categorie;

    @Column(name = "publie_par", nullable = false)
    private Long publiePar;

    @Column(name = "publie_at", nullable = false)
    private Instant publieAt;

    @Column(nullable = false)
    private boolean actif;

    @Column(nullable = false)
    private boolean epinglee;

    @Column(name = "updated_at")
    private Instant updatedAt;
}
