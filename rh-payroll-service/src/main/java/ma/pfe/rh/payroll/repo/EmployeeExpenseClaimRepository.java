package ma.pfe.rh.payroll.repo;

import ma.pfe.rh.payroll.domain.EmployeeExpenseClaim;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EmployeeExpenseClaimRepository extends JpaRepository<EmployeeExpenseClaim, Long> {

    List<EmployeeExpenseClaim> findAllByOrderBySubmittedAtDescIdDesc();

    List<EmployeeExpenseClaim> findAllByEmployeeIdOrderBySubmittedAtDescIdDesc(Long employeeId);
}
