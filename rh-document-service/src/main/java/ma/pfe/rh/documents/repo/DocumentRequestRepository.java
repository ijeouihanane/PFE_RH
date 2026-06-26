package ma.pfe.rh.documents.repo;

import ma.pfe.rh.documents.domain.DocumentRequestEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DocumentRequestRepository extends JpaRepository<DocumentRequestEntity, Long> {

    List<DocumentRequestEntity> findByEmployeeIdOrderByCreatedAtDesc(Long employeeId);

    List<DocumentRequestEntity> findAllByOrderByCreatedAtDesc();
}
