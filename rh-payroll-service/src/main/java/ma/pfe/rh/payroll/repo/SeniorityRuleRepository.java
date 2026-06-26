package ma.pfe.rh.payroll.repo;

import ma.pfe.rh.payroll.domain.SeniorityRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SeniorityRuleRepository extends JpaRepository<SeniorityRule, Long> {

    List<SeniorityRule> findByActiveTrueOrderByMinYearsAsc();
}
