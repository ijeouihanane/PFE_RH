package ma.pfe.rh.documents.repo;

import ma.pfe.rh.documents.domain.ChatLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChatLogRepository extends JpaRepository<ChatLog, Long> {

    List<ChatLog> findTop20ByUserIdOrderByCreatedAtDesc(Long userId);
}
