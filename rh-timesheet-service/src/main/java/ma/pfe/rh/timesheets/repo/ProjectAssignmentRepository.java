package ma.pfe.rh.timesheets.repo;

import ma.pfe.rh.timesheets.domain.ProjectAssignment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProjectAssignmentRepository extends JpaRepository<ProjectAssignment, Long> {

    java.util.List<ProjectAssignment> findByEmployeeId(Long employeeId);

    java.util.List<ProjectAssignment> findByProjectManagerId(Long managerId);

    boolean existsByProjectIdAndEmployeeId(Long projectId, Long employeeId);

    void deleteByProjectIdAndEmployeeId(Long projectId, Long employeeId);
}
