package ma.pfe.rh.leaves.repo;

import ma.pfe.rh.leaves.domain.LeaveRequest;
import ma.pfe.rh.leaves.domain.LeaveStatus;
import ma.pfe.rh.leaves.domain.LeaveType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface LeaveRequestRepository extends JpaRepository<LeaveRequest, Long> {

    long countByStatut(LeaveStatus statut);

    List<LeaveRequest> findByEmployeeIdOrderByCreatedAtDesc(Long employeeId);

    List<LeaveRequest> findByManagerIdAndStatutOrderByCreatedAtDesc(Long managerId, LeaveStatus statut);

    List<LeaveRequest> findByStatutOrderByCreatedAtDesc(LeaveStatus statut);

    List<LeaveRequest> findByStatutAndTypeCongeOrderByCreatedAtDesc(LeaveStatus statut, LeaveType type);

    List<LeaveRequest> findByEmployeeIdAndStatutOrderByCreatedAtDesc(Long employeeId, LeaveStatus statut);
    List<LeaveRequest> findByManagerIdOrderByCreatedAtDesc(Long managerId);

    List<LeaveRequest> findByEmployeeIdAndStatutInAndDateDebutLessThanEqualAndDateFinGreaterThanEqual(
            Long employeeId,
            Collection<LeaveStatus> statuts,
            LocalDate dateFin,
            LocalDate dateDebut
    );
}
