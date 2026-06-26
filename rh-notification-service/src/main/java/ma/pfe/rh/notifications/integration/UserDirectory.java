package ma.pfe.rh.notifications.integration;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
public class UserDirectory {

    private final JdbcTemplate jdbcTemplate;

    public UserDirectory(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Long> findActiveRhUserIds() {
        return jdbcTemplate.queryForList(
                "SELECT id FROM users WHERE actif = 1 AND role = 'RH'",
                Long.class
        );
    }

    public List<Long> findActiveAdminUserIds() {
        return jdbcTemplate.queryForList(
                "SELECT id FROM users WHERE actif = 1 AND role = 'ADMIN'",
                Long.class
        );
    }

    public List<Long> findActiveEmployeeAndManagerIds() {
        return jdbcTemplate.queryForList(
                "SELECT id FROM users WHERE actif = 1 AND role IN ('EMPLOYEE','MANAGER')",
                Long.class
        );
    }

    public Optional<String> findDisplayName(long userId) {
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(
                    """
                    SELECT TRIM(CONCAT(COALESCE(prenom, ''), ' ', COALESCE(nom, ''))) AS full_name
                    FROM users
                    WHERE id = ?
                    """,
                    String.class,
                    userId
            )).filter(name -> !name.isBlank());
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }
}
