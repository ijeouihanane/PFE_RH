package ma.pfe.rh.payroll.repo;

import ma.pfe.rh.payroll.domain.IncomeTaxBracket;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface IncomeTaxBracketRepository extends JpaRepository<IncomeTaxBracket, Long> {

    List<IncomeTaxBracket> findByActiveTrueOrderByMinAnnualIncomeAsc();
}
