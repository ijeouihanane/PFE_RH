package ma.pfe.rh.chat.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "chat_presence")
public class ChatPresence {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "online", nullable = false)
    private boolean online;

    @Column(name = "last_seen_at")
    private Instant lastSeenAt;
}
