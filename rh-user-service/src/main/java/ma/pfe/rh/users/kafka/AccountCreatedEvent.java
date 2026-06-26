package ma.pfe.rh.users.kafka;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AccountCreatedEvent {
    private Long employeeId;
    private String email;
    private String temporaryPassword;
    private String action;
}
