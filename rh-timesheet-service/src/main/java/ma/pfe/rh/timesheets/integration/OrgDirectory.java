package ma.pfe.rh.timesheets.integration;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
public class OrgDirectory {

    private final JdbcTemplate jdbcTemplate;

    public OrgDirectory(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Long findManagerId(long employeeId) {
        try {
            return jdbcTemplate.queryForObject(
                    "SELECT manager_id FROM users WHERE id = ? AND actif = 1",
                    Long.class,
                    employeeId
            );
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    public List<Long> teamMemberIds(long managerId) {
        return jdbcTemplate.queryForList(
                "SELECT id FROM users WHERE manager_id = ? AND actif = 1",
                Long.class,
                managerId
        );
    }

    public List<Long> activeEmployeeAndManagerIds() {
        return jdbcTemplate.queryForList(
                "SELECT id FROM users WHERE actif = 1 AND role IN ('EMPLOYEE','MANAGER')",
                Long.class
        );
    }

    public List<Long> activeRhIds() {
        return jdbcTemplate.queryForList(
                "SELECT id FROM users WHERE actif = 1 AND role = 'RH'",
                Long.class
        );
    }

    public Optional<UserSummary> findUser(long userId) {
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(
                    """
                    SELECT id,
                           COALESCE(prenom, '') AS prenom,
                           COALESCE(nom, '') AS nom,
                           COALESCE(matricule, '') AS matricule,
                           COALESCE(departement, '') AS departement,
                           role
                    FROM users
                    WHERE id = ?
                    """,
                    (rs, rowNum) -> new UserSummary(
                            rs.getLong("id"),
                            (rs.getString("prenom") + " " + rs.getString("nom")).trim(),
                            rs.getString("matricule"),
                            rs.getString("departement"),
                            rs.getString("role")
                    ),
                    userId
            ));
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }

    public record UserSummary(Long id, String fullName, String matricule, String department, String role) {}
}
