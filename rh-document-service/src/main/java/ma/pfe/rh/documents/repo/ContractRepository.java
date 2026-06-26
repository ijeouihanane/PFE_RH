package ma.pfe.rh.documents.repo;

import ma.pfe.rh.documents.domain.ContractEntity;
import ma.pfe.rh.documents.domain.ContractStatus;
import ma.pfe.rh.documents.domain.ContractType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ContractRepository extends JpaRepository<ContractEntity, Long> {

    List<ContractEntity> findAllByOrderByCreatedAtDesc();

    List<ContractEntity> findByStatusOrderByCreatedAtDesc(ContractStatus status);

    List<ContractEntity> findByTypeOrderByCreatedAtDesc(ContractType type);

    List<ContractEntity> findByTypeAndStatusOrderByCreatedAtDesc(ContractType type, ContractStatus status);

    List<ContractEntity> findByEmployeeIdOrderByCreatedAtDesc(Long employeeId);
}
