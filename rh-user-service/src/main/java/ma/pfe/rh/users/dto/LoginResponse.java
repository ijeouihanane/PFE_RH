package ma.pfe.rh.users.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class LoginResponse {
    String token;
    boolean firstLogin;
    UserResponse user;
}
