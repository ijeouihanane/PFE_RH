package ma.pfe.rh.payroll.repo;

import ma.pfe.rh.payroll.domain.PayslipLine;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PayslipLineRepository extends JpaRepository<PayslipLine, Long> {

    List<PayslipLine> findByPayslipId(Long payslipId);

    void deleteByPayslipId(Long payslipId);
}
