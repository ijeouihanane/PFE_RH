package ma.pfe.rh.documents.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Historique des échanges chatbot. Chaque employé ne voit que ses propres logs.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "chat_logs")
public class ChatLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String question;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String answer;

    @Column(name = "doc_source")
    private String docSource;

    @Column(name = "page_number")
    private Integer pageNumber;

    @Column(name = "page_range")
    private String pageRange;

    @Column(name = "confidence_score")
    private Double confidenceScore;

    private Boolean answered;

    @Column(name = "model_used")
    private String modelUsed;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
