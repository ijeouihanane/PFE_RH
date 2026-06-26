package ma.pfe.rh.leaves.repo;

import ma.pfe.rh.leaves.domain.LeaveBalance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface LeaveBalanceRepository extends JpaRepository<LeaveBalance, Long> {

    Optional<LeaveBalance> findByEmployeeIdAndAnnee(long employeeId, int annee);
}
