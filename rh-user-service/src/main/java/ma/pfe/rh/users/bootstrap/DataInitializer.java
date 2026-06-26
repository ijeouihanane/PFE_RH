package ma.pfe.rh.users.bootstrap;

import lombok.RequiredArgsConstructor;
import ma.pfe.rh.users.domain.Role;
import ma.pfe.rh.users.domain.TypeContrat;
import ma.pfe.rh.users.domain.User;
import ma.pfe.rh.users.repo.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Override
    public void run(String... args) {
        if (userRepository.count() > 0) {
            return;
        }
        Instant now = Instant.now();
        User admin = User.builder()
                .nom("Admin")
                .prenom("TechCorp")
                .email("admin@techcorp.ma")
                .password(passwordEncoder.encode("Admin@1234"))
                .role(Role.ADMIN)
                .typeContrat(TypeContrat.CDI)
                .poste("Administrateur système")
                .departement("IT")
                .matricule("ADM-001")
                .ville("Casablanca")
                .statut("ACTIF")
                .dateEmbauche(LocalDate.now())
                .actif(true)
                .firstLogin(false)
                .createdAt(now)
                .updatedAt(now)
                .build();

        User rh = User.builder()
                .nom("RH")
                .prenom("TechCorp")
                .email("rh@techcorp.ma")
                .password(passwordEncoder.encode("Rh@1234"))
                .role(Role.RH)
                .typeContrat(TypeContrat.CDI)
                .poste("Responsable RH")
                .departement("RH")
                .matricule("RH-001")
                .ville("Casablanca")
                .statut("ACTIF")
                .dateEmbauche(LocalDate.now())
                .actif(true)
                .firstLogin(false)
                .createdAt(now)
                .updatedAt(now)
                .build();

        userRepository.save(admin);
        userRepository.save(rh);
    }
}
