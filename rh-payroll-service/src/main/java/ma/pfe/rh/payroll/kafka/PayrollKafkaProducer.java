package ma.pfe.rh.payroll.kafka;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class PayrollKafkaProducer {

    public static final String TOPIC_PAYSLIP_UPLOADED = "payslip.uploaded";
    public static final String TOPIC_PAYSLIP_SENT     = "payslip.sent";

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public void payslipUploaded(Map<String, Object> payload) {
        try {
            kafkaTemplate.send(TOPIC_PAYSLIP_UPLOADED, String.valueOf(payload.get("payslipId")), objectMapper.writeValueAsString(payload));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Sérialisation Kafka impossible", e);
        }
    }

    public void payslipSent(Map<String, Object> payload) {
        try {
            kafkaTemplate.send(TOPIC_PAYSLIP_SENT, String.valueOf(payload.get("payslipId")), objectMapper.writeValueAsString(payload));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Sérialisation Kafka impossible", e);
        }
    }
}
