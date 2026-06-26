package ma.pfe.rh.documents.kafka;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class DocumentKafkaProducer {

    public static final String TOPIC_PUBLISHED = "document.published";
    public static final String TOPIC_REQUESTED = "document.requested";
    public static final String TOPIC_REQUEST_READY = "document.request.ready";
    public static final String TOPIC_REQUEST_REFUSED = "document.request.refused";

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public void published(Map<String, Object> payload) {
        send(TOPIC_PUBLISHED, payload.get("documentId"), payload);
    }

    public void requestCreated(Map<String, Object> payload) {
        send(TOPIC_REQUESTED, payload.get("requestId"), payload);
    }

    public void requestReady(Map<String, Object> payload) {
        send(TOPIC_REQUEST_READY, payload.get("requestId"), payload);
    }

    public void requestRefused(Map<String, Object> payload) {
        send(TOPIC_REQUEST_REFUSED, payload.get("requestId"), payload);
    }

    private void send(String topic, Object keyValue, Map<String, Object> payload) {
        try {
            String key = String.valueOf(keyValue);
            kafkaTemplate.send(topic, key, objectMapper.writeValueAsString(payload));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Serialisation Kafka impossible", e);
        }
    }
}
