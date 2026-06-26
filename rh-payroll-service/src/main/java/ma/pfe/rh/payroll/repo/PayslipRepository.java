package ma.pfe.rh.payroll.repo;

import ma.pfe.rh.payroll.domain.Payslip;
import ma.pfe.rh.payroll.domain.PayslipStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PayslipRepository extends JpaRepository<Payslip, Long> {

    List<Payslip> findByEmployeeIdOrderByAnneeDescMoisDesc(Long employeeId);

    List<Payslip> findByEmployeeIdAndStatusNotOrderByAnneeDescMoisDesc(Long employeeId, PayslipStatus status);

    List<Payslip> findByEmployeeIdAndStatusOrderByAnneeDescMoisDesc(Long employeeId, PayslipStatus status);

    Optional<Payslip> findByEmployeeIdAndMoisAndAnnee(Long employeeId, int mois, int annee);

    boolean existsByEmployeeIdAndMoisAndAnneeAndStatusNot(Long employeeId, int mois, int annee, PayslipStatus status);
}
