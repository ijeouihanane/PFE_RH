package ma.pfe.rh.chat.repo;

import ma.pfe.rh.chat.domain.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    List<ChatMessage> findByConversationIdAndDeletedAtIsNullOrderByCreatedAtAsc(Long conversationId);

    Optional<ChatMessage> findTopByConversationIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long conversationId);

    @Query("""
            SELECT m FROM ChatMessage m
            WHERE m.id IN (
              SELECT MAX(x.id) FROM ChatMessage x
              WHERE x.conversationId IN :conversationIds AND x.deletedAt IS NULL
              GROUP BY x.conversationId
            )
            """)
    List<ChatMessage> findLastMessages(@Param("conversationIds") Collection<Long> conversationIds);

    long countByConversationIdAndIdGreaterThanAndSenderIdNotAndDeletedAtIsNull(
            Long conversationId,
            Long lastReadMessageId,
            Long senderId
    );

    long countByConversationIdAndSenderIdNotAndDeletedAtIsNull(Long conversationId, Long senderId);
}
