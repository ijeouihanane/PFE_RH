package ma.pfe.rh.chat.repo;

import ma.pfe.rh.chat.domain.ChatParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ChatParticipantRepository extends JpaRepository<ChatParticipant, Long> {

    List<ChatParticipant> findByUserId(Long userId);

    List<ChatParticipant> findByConversationId(Long conversationId);

    Optional<ChatParticipant> findByConversationIdAndUserId(Long conversationId, Long userId);

    boolean existsByConversationIdAndUserId(Long conversationId, Long userId);

    @Query("""
            SELECT p1.conversationId FROM ChatParticipant p1
            JOIN ChatParticipant p2 ON p1.conversationId = p2.conversationId
            WHERE p1.userId = :a AND p2.userId = :b
            """)
    List<Long> findConversationIdsForPair(@Param("a") Long a, @Param("b") Long b);
}
