package ma.pfe.rh.chat.repo;

import ma.pfe.rh.chat.domain.ChatPresence;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatPresenceRepository extends JpaRepository<ChatPresence, Long> {
}
