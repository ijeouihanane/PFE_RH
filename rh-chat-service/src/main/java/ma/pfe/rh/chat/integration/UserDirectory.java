package ma.pfe.rh.chat.integration;

import ma.pfe.rh.chat.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class UserDirectory {

    private final JdbcTemplate jdbcTemplate;

    public UserDirectory(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public UserSummary requireActiveUser(Long id) {
        List<UserSummary> users = jdbcTemplate.query(
                "SELECT id, nom, prenom, email, role, photo_url FROM users WHERE id = ? AND actif = 1",
                (rs, rowNum) -> new UserSummary(
                        rs.getLong("id"),
                        rs.getString("nom"),
                        rs.getString("prenom"),
                        rs.getString("email"),
                        rs.getString("role"),
                        rs.getString("photo_url")
                ),
                id
        );
        if (users.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Utilisateur introuvable");
        }
        return users.get(0);
    }

    public UserSummary requireFirstActiveRh() {
        List<UserSummary> users = jdbcTemplate.query(
                "SELECT id, nom, prenom, email, role, photo_url FROM users WHERE actif = 1 AND role = 'RH' ORDER BY id LIMIT 1",
                (rs, rowNum) -> new UserSummary(
                        rs.getLong("id"),
                        rs.getString("nom"),
                        rs.getString("prenom"),
                        rs.getString("email"),
                        rs.getString("role"),
                        rs.getString("photo_url")
                )
        );
        if (users.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Aucun RH actif trouvé");
        }
        return users.get(0);
    }
}
