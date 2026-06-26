package ma.pfe.rh.chat.repo;

import ma.pfe.rh.chat.domain.ChatAttachment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ChatAttachmentRepository extends JpaRepository<ChatAttachment, Long> {

    Optional<ChatAttachment> findByMessageId(Long messageId);
}
