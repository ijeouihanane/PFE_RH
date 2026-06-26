package ma.pfe.rh.users.repo;

import ma.pfe.rh.users.domain.AppraisalGridTemplate;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AppraisalGridTemplateRepository extends JpaRepository<AppraisalGridTemplate, Long> {
    Optional<AppraisalGridTemplate> findByCode(String code);
    Optional<AppraisalGridTemplate> findFirstByDepartmentIgnoreCaseAndActiveTrue(String department);
    Optional<AppraisalGridTemplate> findFirstByDepartmentIsNullAndActiveTrue();
    List<AppraisalGridTemplate> findAllByOrderByDepartmentAscVersionNumberDesc();
    List<AppraisalGridTemplate> findByDepartmentIgnoreCaseOrderByVersionNumberDesc(String department);
    List<AppraisalGridTemplate> findByDepartmentIsNullOrderByVersionNumberDesc();
    boolean existsByDepartmentIgnoreCaseAndActiveTrue(String department);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT g FROM AppraisalGridTemplate g
            WHERE g.active = true
              AND LOWER(g.department) = LOWER(:department)
            """)
    Optional<AppraisalGridTemplate> lockActiveByDepartment(@Param("department") String department);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT g FROM AppraisalGridTemplate g WHERE g.active = true AND g.department IS NULL")
    Optional<AppraisalGridTemplate> lockActiveGeneric();
}
