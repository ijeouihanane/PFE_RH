package ma.pfe.rh.payroll.repo;

import ma.pfe.rh.payroll.domain.PayrollProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PayrollProfileRepository extends JpaRepository<PayrollProfile, Long> {

    Optional<PayrollProfile> findByEmployeeId(Long employeeId);
}
