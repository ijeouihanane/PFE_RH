package ma.pfe.rh.users.repo;

import ma.pfe.rh.users.domain.AppraisalCriterionResponse;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AppraisalCriterionResponseRepository extends JpaRepository<AppraisalCriterionResponse, Long> {
    List<AppraisalCriterionResponse> findByAppraisalIdOrderByCriterionDisplayOrder(Long appraisalId);
}
