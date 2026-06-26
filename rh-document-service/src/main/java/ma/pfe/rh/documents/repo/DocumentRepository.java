package ma.pfe.rh.documents.repo;

import ma.pfe.rh.documents.domain.DocType;
import ma.pfe.rh.documents.domain.DocumentEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DocumentRepository extends JpaRepository<DocumentEntity, Long> {

    List<DocumentEntity> findByActifTrueOrderByPublieAtDesc();

    List<DocumentEntity> findByActifTrueAndTypeOrderByEpingleeDescPublieAtDesc(DocType type);

    List<DocumentEntity> findByTypeOrderByEpingleeDescPublieAtDesc(DocType type);

    List<DocumentEntity> findTop3ByActifTrueAndTypeOrderByPublieAtDesc(DocType type);
}
