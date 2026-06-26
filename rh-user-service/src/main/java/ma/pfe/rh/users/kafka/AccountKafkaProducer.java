package ma.pfe.rh.users.kafka;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AccountKafkaProducer {

    public static final String TOPIC_ACCOUNT_CREATED = "account.created";
    public static final String TOPIC_PROFILE_CREATED = "profile.created";

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public void publishAccountCreated(AccountCreatedEvent event) {
        try {
            String json = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(TOPIC_ACCOUNT_CREATED, String.valueOf(event.getEmployeeId()), json);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Impossible de sérialiser l'événement Kafka", e);
        }
    }

    public void publishProfileCreated(AccountCreatedEvent event) {
        try {
            String json = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(TOPIC_PROFILE_CREATED, String.valueOf(event.getEmployeeId()), json);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Impossible de serialiser l'evenement Kafka", e);
        }
    }
}
