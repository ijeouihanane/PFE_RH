package ma.pfe.rh.payroll.repo;

import ma.pfe.rh.payroll.domain.PayrollParameter;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PayrollParameterRepository extends JpaRepository<PayrollParameter, Long> {

    List<PayrollParameter> findByActiveTrue();

    Optional<PayrollParameter> findByCodeAndActiveTrue(String code);
}
