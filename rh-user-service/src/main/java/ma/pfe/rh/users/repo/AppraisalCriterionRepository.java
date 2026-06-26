package ma.pfe.rh.users.repo;

import ma.pfe.rh.users.domain.AppraisalCriterion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AppraisalCriterionRepository extends JpaRepository<AppraisalCriterion, Long> {
    List<AppraisalCriterion> findByGridTemplateIdAndActiveTrueOrderByDisplayOrder(Long gridTemplateId);
    List<AppraisalCriterion> findByGridTemplateIdOrderByDisplayOrder(Long gridTemplateId);
    long countByGridTemplateId(Long gridTemplateId);
}
