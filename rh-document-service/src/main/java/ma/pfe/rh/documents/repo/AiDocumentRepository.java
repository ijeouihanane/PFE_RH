package ma.pfe.rh.documents.repo;

import ma.pfe.rh.documents.domain.AiDocument;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AiDocumentRepository extends JpaRepository<AiDocument, Long> {

    List<AiDocument> findAllByOrderByCreatedAtDesc();

    long countByIndexedInAITrue();
}
