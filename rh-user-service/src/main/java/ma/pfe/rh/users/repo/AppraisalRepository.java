package ma.pfe.rh.users.repo;

import ma.pfe.rh.users.domain.Appraisal;
import ma.pfe.rh.users.domain.AppraisalStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AppraisalRepository extends JpaRepository<Appraisal, Long> {

    List<Appraisal> findByManagerIdOrderByCreatedAtDesc(Long managerId);

    List<Appraisal> findByEmployeeIdOrderByCreatedAtDesc(Long employeeId);

    List<Appraisal> findAllByOrderByCreatedAtDesc();

    Optional<Appraisal> findFirstByEmployeeIdAndStatutInAndGridTemplateIsNotNullOrderByCreatedAtDesc(
            Long employeeId,
            List<AppraisalStatus> statuses
    );

    Optional<Appraisal> findByEmployeeIdAndPeriode(Long employeeId, String periode);

    Optional<Appraisal> findByIdAndManagerId(Long id, Long managerId);
}
