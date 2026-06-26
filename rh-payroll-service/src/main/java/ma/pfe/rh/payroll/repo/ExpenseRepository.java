package ma.pfe.rh.payroll.repo;

import ma.pfe.rh.payroll.domain.Expense;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    List<Expense> findAllByOrderByDateHeureDescIdDesc();

    List<Expense> findByDateHeureBetween(LocalDateTime start, LocalDateTime end);
}
