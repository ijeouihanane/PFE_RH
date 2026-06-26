package ma.pfe.rh.leaves.kafka;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class LeaveKafkaProducer {

    public static final String TOPIC_REQUESTED = "leave.requested";
    public static final String TOPIC_MANAGER_APPROVED = "leave.manager.approved";
    public static final String TOPIC_APPROVED = "leave.approved";
    public static final String TOPIC_REJECTED = "leave.rejected";

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public void publish(String topic, String key, Map<String, Object> payload) {
        try {
            kafkaTemplate.send(topic, key, objectMapper.writeValueAsString(payload));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Sérialisation Kafka impossible", e);
        }
    }
}
