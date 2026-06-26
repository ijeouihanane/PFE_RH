package ma.pfe.rh.users.service;

import lombok.RequiredArgsConstructor;
import ma.pfe.rh.users.domain.Role;
import ma.pfe.rh.users.domain.User;
import ma.pfe.rh.users.dto.AdminDashboardSummaryResponse;
import ma.pfe.rh.users.dto.CreateAccountResultResponse;
import ma.pfe.rh.users.dto.UserResponse;
import ma.pfe.rh.users.kafka.AccountCreatedEvent;
import ma.pfe.rh.users.kafka.AccountKafkaProducer;
import ma.pfe.rh.users.repo.UserRepository;
import ma.pfe.rh.users.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class AdminAccountService {

    private static final List<Role> MANAGEABLE = List.of(Role.EMPLOYEE, Role.MANAGER);
    private static final String TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.FRENCH)
            .withZone(ZoneId.systemDefault());

    private final UserRepository userRepository;
    private final AccountKafkaProducer accountKafkaProducer;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public List<UserResponse> pending() {
        return userRepository.findPendingAccount(MANAGEABLE).stream().map(UserResponse::from).toList();
    }

    public List<UserResponse> activeAccounts() {
        return userRepository.findActiveAccounts(MANAGEABLE).stream().map(UserResponse::from).toList();
    }

    public List<UserResponse> disabledAccounts() {
        return userRepository.findByActifFalseOrderByUpdatedAtDesc().stream()
                .filter(u -> u.getRole() == Role.EMPLOYEE || u.getRole() == Role.MANAGER)
                .map(UserResponse::from)
                .toList();
    }

    public AdminDashboardSummaryResponse dashboardSummary() {
        List<User> users = userRepository.findAllByOrderByCreatedAtDesc();
        int total = users.size();
        int active = (int) users.stream().filter(this::isActiveAccount).count();
        int pending = (int) users.stream().filter(this::isPendingAccount).count();
        int disabled = (int) users.stream().filter(u -> !u.isActif()).count();
        int missingManager = (int) users.stream()
                .filter(u -> u.getRole() == Role.EMPLOYEE && isActiveAccount(u) && u.getManagerId() == null)
                .count();
        int neverLogged = (int) users.stream().filter(u -> isActiveAccount(u) && u.getLastLogin() == null).count();
        int activationRate = total == 0 ? 0 : Math.round((active * 100f) / total);

        return AdminDashboardSummaryResponse.builder()
                .totalComptes(total)
                .comptesActifs(active)
                .comptesEnAttente(pending)
                .comptesDesactives(disabled)
                .sansManager(missingManager)
                .jamaisConnectes(neverLogged)
                .tauxActivation(activationRate)
                .repartitionStatut(List.of(
                        metric("Actifs", active, total, "green"),
                        metric("En attente", pending, total, "amber"),
                        metric("Désactivés", disabled, total, "red")
                ))
                .repartitionRole(roleRows(users))
                .repartitionDepartement(departmentRows(users))
                .hygieneAcces(List.of(
                        health("Sans manager", missingManager, "à suivre", "amber"),
                        health("Jamais connectés", neverLogged, "à risque", "red"),
                        health("Comptes en attente", pending, "à suivre", "amber"),
                        health("Comptes désactivés", disabled, "à risque", "red")
                ))
                .comptesASurveiller(watchRows(users))
                .build();
    }

    @Transactional
    public CreateAccountResultResponse createAccount(Long userId) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Utilisateur introuvable"));
        if (!(u.getRole() == Role.EMPLOYEE || u.getRole() == Role.MANAGER)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Ce profil ne nécessite pas cette activation");
        }
        if (u.getPassword() != null && !u.getPassword().isBlank()) {
            throw new ApiException(HttpStatus.CONFLICT, "Compte déjà créé");
        }
        String temp = temporaryPassword(u.getEmail());
        u.setPassword(passwordEncoder.encode(temp));
        u.setFirstLogin(true);
        u.setActif(true);
        u.setUpdatedAt(Instant.now());
        userRepository.save(u);

        accountKafkaProducer.publishAccountCreated(AccountCreatedEvent.builder()
                .employeeId(u.getId())
                .email(u.getEmail())
                .temporaryPassword(temp)
                .action("CREATE")
                .build());

        return CreateAccountResultResponse.builder()
                .userId(u.getId())
                .email(u.getEmail())
                .emailQueued(true)
                .firstLogin(true)
                .build();
    }

    @Transactional
    public CreateAccountResultResponse resetPassword(Long userId) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Utilisateur introuvable"));
        if (!(u.getRole() == Role.EMPLOYEE || u.getRole() == Role.MANAGER)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Action non applicable");
        }
        String temp = temporaryPassword(u.getEmail());
        u.setPassword(passwordEncoder.encode(temp));
        u.setFirstLogin(true);
        u.setUpdatedAt(Instant.now());
        userRepository.save(u);

        accountKafkaProducer.publishAccountCreated(AccountCreatedEvent.builder()
                .employeeId(u.getId())
                .email(u.getEmail())
                .temporaryPassword(temp)
                .action("RESET")
                .build());

        return CreateAccountResultResponse.builder()
                .userId(u.getId())
                .email(u.getEmail())
                .emailQueued(true)
                .firstLogin(true)
                .build();
    }

    @Transactional
    public void deactivateAccount(Long userId) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Utilisateur introuvable"));
        if (!(u.getRole() == Role.EMPLOYEE || u.getRole() == Role.MANAGER)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Action non applicable");
        }
        u.setActif(false);
        u.setUpdatedAt(Instant.now());
        userRepository.save(u);
    }

    @Transactional
    public void reactivateAccount(Long userId) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Utilisateur introuvable"));
        if (!(u.getRole() == Role.EMPLOYEE || u.getRole() == Role.MANAGER)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Action non applicable");
        }
        if (u.getPassword() == null || u.getPassword().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Réactivez après avoir recréé un mot de passe (compte en attente)");
        }
        u.setActif(true);
        u.setUpdatedAt(Instant.now());
        userRepository.save(u);
    }

    private static String temporaryPassword(String email) {
        return "Tc-" + randomChunk(4) + "-" + randomChunk(4);
    }

    private boolean isActiveAccount(User u) {
        return u.isActif() && u.getPassword() != null && !u.getPassword().isBlank();
    }

    private boolean isPendingAccount(User u) {
        return u.isActif() && (u.getPassword() == null || u.getPassword().isBlank());
    }

    private List<AdminDashboardSummaryResponse.MetricRow> roleRows(List<User> users) {
        Map<Role, String> labels = Map.of(
                Role.EMPLOYEE, "Employés",
                Role.MANAGER, "Managers",
                Role.RH, "RH",
                Role.ADMIN, "Admin"
        );
        return List.of(Role.EMPLOYEE, Role.MANAGER, Role.RH, Role.ADMIN).stream()
                .map(role -> metric(labels.get(role), (int) users.stream().filter(u -> u.getRole() == role).count(), users.size(), roleTone(role)))
                .toList();
    }

    private List<AdminDashboardSummaryResponse.MetricRow> departmentRows(List<User> users) {
        Map<String, Long> byDepartment = users.stream()
                .map(User::getDepartement)
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .collect(java.util.stream.Collectors.groupingBy(s -> s, java.util.stream.Collectors.counting()));
        int max = byDepartment.values().stream().mapToInt(Long::intValue).max().orElse(0);
        List<String> tones = List.of("blue", "cyan", "green", "amber", "violet", "pink");
        final int[] index = {0};
        return byDepartment.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(entry -> AdminDashboardSummaryResponse.MetricRow.builder()
                        .label(entry.getKey())
                        .value(entry.getValue().intValue())
                        .pct(max == 0 ? 0 : Math.round((entry.getValue() * 100f) / max))
                        .tone(tones.get((index[0]++) % tones.size()))
                        .build())
                .toList();
    }

    private List<AdminDashboardSummaryResponse.WatchAccount> watchRows(List<User> users) {
        return users.stream()
                .map(this::watchRow)
                .filter(Objects::nonNull)
                .sorted(Comparator.comparingInt(this::priorityOrder).thenComparing(AdminDashboardSummaryResponse.WatchAccount::getName))
                .limit(6)
                .toList();
    }

    private AdminDashboardSummaryResponse.WatchAccount watchRow(User u) {
        if (isActiveAccount(u) && u.getLastLogin() == null) {
            return watch(u, "Jamais connecté", "Risque", "Créé le " + format(u.getCreatedAt()), "red");
        }
        if (!u.isActif()) {
            return watch(u, "Désactivé", "Risque", "Désactivé le " + format(u.getUpdatedAt()), "red");
        }
        if (u.getRole() == Role.EMPLOYEE && isActiveAccount(u) && u.getManagerId() == null) {
            return watch(u, "Sans manager", "À traiter", "MAJ le " + format(u.getUpdatedAt()), "amber");
        }
        if (isPendingAccount(u)) {
            return watch(u, "En attente", "À traiter", "Créé le " + format(u.getCreatedAt()), "amber");
        }
        return null;
    }

    private AdminDashboardSummaryResponse.WatchAccount watch(User u, String status, String priority, String detail, String tone) {
        return AdminDashboardSummaryResponse.WatchAccount.builder()
                .initials(initials(u))
                .name((safe(u.getPrenom()) + " " + safe(u.getNom())).trim())
                .role(roleLabel(u.getRole()))
                .status(status)
                .priority(priority)
                .detail(detail)
                .tone(tone)
                .build();
    }

    private int priorityOrder(AdminDashboardSummaryResponse.WatchAccount row) {
        if ("red".equals(row.getTone())) return 0;
        if ("amber".equals(row.getTone())) return 1;
        return 2;
    }

    private AdminDashboardSummaryResponse.MetricRow metric(String label, int value, int total, String tone) {
        return AdminDashboardSummaryResponse.MetricRow.builder()
                .label(label)
                .value(value)
                .pct(total == 0 ? 0 : Math.round((value * 100f) / total))
                .tone(tone)
                .build();
    }

    private AdminDashboardSummaryResponse.AccessHealthItem health(String label, int value, String status, String tone) {
        return AdminDashboardSummaryResponse.AccessHealthItem.builder()
                .label(label)
                .value(value)
                .status(status)
                .tone(tone)
                .build();
    }

    private String roleTone(Role role) {
        return switch (role) {
            case EMPLOYEE -> "blue";
            case MANAGER -> "cyan";
            case RH -> "green";
            case ADMIN -> "violet";
        };
    }

    private String roleLabel(Role role) {
        return switch (role) {
            case EMPLOYEE -> "Employé";
            case MANAGER -> "Manager";
            case RH -> "RH";
            case ADMIN -> "Admin";
        };
    }

    private String initials(User u) {
        String first = safe(u.getPrenom());
        String last = safe(u.getNom());
        String a = first.isBlank() ? "" : first.substring(0, 1);
        String b = last.isBlank() ? "" : last.substring(0, 1);
        String out = (a + b).toUpperCase(Locale.ROOT);
        return out.isBlank() ? "U" : out;
    }

    private String format(Instant instant) {
        return instant == null ? "-" : DATE_FORMATTER.format(instant);
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private static String randomChunk(int length) {
        StringBuilder out = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            out.append(TEMP_PASSWORD_ALPHABET.charAt(RANDOM.nextInt(TEMP_PASSWORD_ALPHABET.length())));
        }
        return out.toString();
    }
}
