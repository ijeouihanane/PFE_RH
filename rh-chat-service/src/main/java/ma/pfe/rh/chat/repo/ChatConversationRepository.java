package ma.pfe.rh.chat.repo;

import ma.pfe.rh.chat.domain.ChatConversation;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatConversationRepository extends JpaRepository<ChatConversation, Long> {
}
