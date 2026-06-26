package ma.pfe.rh.leaves.repo;

import ma.pfe.rh.leaves.domain.LeaveHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LeaveHistoryRepository extends JpaRepository<LeaveHistory, Long> {

    List<LeaveHistory> findByLeaveRequestIdOrderByCreatedAtAsc(Long leaveRequestId);
}
