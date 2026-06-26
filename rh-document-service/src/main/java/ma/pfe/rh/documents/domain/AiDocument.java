package ma.pfe.rh.documents.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

/**
 * Entité séparée pour les documents PDF uploadés par le RH
 * destinés au chatbot IA (RAG). Table indépendante de "documents" (annonces).
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "ai_documents")
public class AiDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String titre;

    @Column(name = "original_file_name", nullable = false)
    private String originalFileName;

    @Column(name = "file_path", nullable = false)
    private String filePath;

    @Column(name = "fichier_url")
    private String fichierUrl;

    @Column(name = "nb_pages")
    private Integer nbPages;

    @Column(name = "nb_chunks")
    private Integer nbChunks;

    @Column(columnDefinition = "TEXT")
    private String summary;

    private String keywords;

    @Column(name = "indexed_in_ai")
    private Boolean indexedInAI;

    @Column(name = "uploaded_by", nullable = false)
    private Long uploadedBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
