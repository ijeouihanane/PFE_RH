package ma.pfe.rh.chat.kafka;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class ChatKafkaProducer {

    public static final String TOPIC_MESSAGE_CREATED = "chat.message.created";
    private static final Logger log = LoggerFactory.getLogger(ChatKafkaProducer.class);

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public void messageCreated(Map<String, Object> payload) {
        try {
            kafkaTemplate.send(
                    TOPIC_MESSAGE_CREATED,
                    String.valueOf(payload.get("recipientId")),
                    objectMapper.writeValueAsString(payload)
            );
        } catch (JsonProcessingException e) {
            log.warn("Notification chat non publiée: payload invalide", e);
        } catch (RuntimeException e) {
            log.warn("Notification chat non publiée: Kafka indisponible", e);
        }
    }
}
