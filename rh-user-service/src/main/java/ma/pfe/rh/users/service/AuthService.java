package ma.pfe.rh.users.service;

import lombok.RequiredArgsConstructor;
import ma.pfe.rh.users.domain.User;
import ma.pfe.rh.users.dto.LoginRequest;
import ma.pfe.rh.users.dto.LoginResponse;
import ma.pfe.rh.users.dto.UserResponse;
import ma.pfe.rh.users.repo.UserRepository;
import ma.pfe.rh.users.security.JwtService;
import ma.pfe.rh.users.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Transactional
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByEmailIgnoreCase(request.getEmail().trim())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Identifiants invalides"));

        if (!user.isActif()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Compte désactivé");
        }
        if (user.getPassword() == null || user.getPassword().isBlank()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Compte en attente d'activation par l'administrateur");
        }
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Identifiants invalides");
        }

        user.setLastLogin(Instant.now());
        userRepository.save(user);

        String token = jwtService.generateToken(user);
        return LoginResponse.builder()
                .token(token)
                .firstLogin(user.isFirstLogin())
                .user(UserResponse.from(user))
                .build();
    }
}
