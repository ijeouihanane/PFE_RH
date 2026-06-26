package ma.pfe.rh.users.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class CreateAccountResultResponse {
    Long userId;
    String email;
    boolean emailQueued;
    boolean firstLogin;
}
