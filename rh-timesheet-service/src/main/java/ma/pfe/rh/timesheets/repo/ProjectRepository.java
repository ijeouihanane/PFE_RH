package ma.pfe.rh.timesheets.repo;

import ma.pfe.rh.timesheets.domain.Project;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProjectRepository extends JpaRepository<Project, Long> {

    List<Project> findByManagerIdAndActifTrue(Long managerId);

    List<Project> findByActifTrue();
}
