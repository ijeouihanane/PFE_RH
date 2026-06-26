package ma.pfe.rh.leaves.integration;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class UserDirectory {

    private final JdbcTemplate jdbcTemplate;

    public UserDirectory(JdbcTemplate jdbcTemplate) {
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
}
