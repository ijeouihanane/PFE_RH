package ma.pfe.rh.timesheets.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class TimesheetKafkaProducer {

    public static final String TOPIC_SUBMITTED = "timesheet.submitted";
    public static final String TOPIC_APPROVED = "timesheet.approved";
    public static final String TOPIC_REJECTED = "timesheet.rejected";
    public static final String TOPIC_REMINDER = "timesheet.reminder";

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public void submitted(Map<String, Object> payload) {
        safePublish(TOPIC_SUBMITTED, payload);
    }

    public void safePublish(String topic, Map<String, Object> payload) {
        try {
            String key = String.valueOf(payload.getOrDefault("timesheetId", payload.getOrDefault("recipientId", "timesheet")));
            kafkaTemplate.send(topic, key, objectMapper.writeValueAsString(payload));
        } catch (Exception ignored) {
            // Notifications must never block timesheet workflow.
        }
    }
}
