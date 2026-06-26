package ma.pfe.rh.timesheets.repo;

import ma.pfe.rh.timesheets.domain.Timesheet;
import ma.pfe.rh.timesheets.domain.TimesheetStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TimesheetRepository extends JpaRepository<Timesheet, Long> {

    Optional<Timesheet> findByEmployeeIdAndSemaineDebut(Long employeeId, LocalDate semaineDebut);

    List<Timesheet> findByEmployeeIdOrderBySemaineDebutDesc(Long employeeId);

    List<Timesheet> findByEmployeeIdInAndStatutOrderBySemaineDebutDesc(Collection<Long> employeeIds, TimesheetStatus statut);

    List<Timesheet> findByEmployeeIdInAndStatutInOrderBySemaineDebutDesc(Collection<Long> employeeIds, Collection<TimesheetStatus> statuts);
}
