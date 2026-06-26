package ma.pfe.rh.users.service;

import lombok.RequiredArgsConstructor;
import ma.pfe.rh.users.domain.Role;
import ma.pfe.rh.users.domain.TypeContrat;
import ma.pfe.rh.users.domain.User;
import ma.pfe.rh.users.dto.EmployeeCreateRequest;
import ma.pfe.rh.users.dto.EmployeeUpdateRequest;
import ma.pfe.rh.users.dto.ProfileSelfUpdateRequest;
import ma.pfe.rh.users.dto.UserResponse;
import ma.pfe.rh.users.kafka.AccountCreatedEvent;
import ma.pfe.rh.users.kafka.AccountKafkaProducer;
import ma.pfe.rh.users.repo.UserRepository;
import ma.pfe.rh.users.storage.FileStorageService;
import ma.pfe.rh.users.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;
    private final AccountKafkaProducer accountKafkaProducer;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public UserResponse me(Long userId) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Utilisateur introuvable"));
        return UserResponse.from(u);
    }

    public UserResponse summary(Long userId) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Utilisateur introuvable"));
        return UserResponse.from(u);
    }

    @Transactional
    public UserResponse updateSelf(Long userId, ProfileSelfUpdateRequest req) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Utilisateur introuvable"));
        if (req.getNom() != null) {
            u.setNom(req.getNom());
        }
        if (req.getPrenom() != null) {
            u.setPrenom(req.getPrenom());
        }
        if (req.getCin() != null) {
            u.setCin(req.getCin());
        }
        if (req.getTelephone() != null) {
            u.setTelephone(req.getTelephone());
        }
        if (req.getDateNaissance() != null) {
            u.setDateNaissance(req.getDateNaissance());
        }
        if (req.getEtatCivil() != null) {
            u.setEtatCivil(req.getEtatCivil());
        }
        if (req.getAdresse() != null) {
            u.setAdresse(req.getAdresse());
        }
        if (req.getVille() != null) {
            u.setVille(req.getVille());
        }
        if (req.getNationalite() != null) {
            u.setNationalite(req.getNationalite());
        }
        if (req.getNomBanque() != null) {
            u.setNomBanque(req.getNomBanque());
        }
        if (req.getRib() != null) {
            u.setRib(req.getRib());
        }
        if (req.getCnss() != null) {
            u.setCnss(req.getCnss());
        }
        u.setUpdatedAt(Instant.now());
        return UserResponse.from(userRepository.save(u));
    }

    @Transactional
    public void changePassword(Long userId, String ancien, String nouveau) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Utilisateur introuvable"));
        if (u.getPassword() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Mot de passe non initialisé");
        }
        if (!passwordEncoder.matches(ancien, u.getPassword())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Ancien mot de passe incorrect");
        }
        u.setPassword(passwordEncoder.encode(nouveau));
        u.setFirstLogin(false);
        u.setUpdatedAt(Instant.now());
        userRepository.save(u);
    }

    public List<UserResponse> searchRh(String departement, String poste, String typeContrat, String statut) {
        TypeContrat tc = null;
        if (typeContrat != null && !typeContrat.isBlank()) {
            try {
                tc = TypeContrat.valueOf(typeContrat.trim());
            } catch (IllegalArgumentException e) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "typeContrat invalide");
            }
        }
        String dep = emptyToNull(departement);
        String po = emptyToNull(poste);
        String st = emptyToNull(statut);
        return userRepository.searchActive(dep, po, tc, st).stream().map(UserResponse::from).toList();
    }

    @Transactional
    public UserResponse createEmployee(EmployeeCreateRequest req) {
        if (userRepository.existsByEmailIgnoreCase(req.getEmail().trim())) {
            throw new ApiException(HttpStatus.CONFLICT, "Email déjà utilisé");
        }
        Instant now = Instant.now();
        User u = User.builder()
                .nom(req.getNom().trim())
                .prenom(req.getPrenom().trim())
                .email(req.getEmail().trim().toLowerCase())
                .password(null)
                .cin(trimToNull(req.getCin()))
                .telephone(trimToNull(req.getTelephone()))
                .dateNaissance(req.getDateNaissance())
                .etatCivil(trimToNull(req.getEtatCivil()))
                .adresse(trimToNull(req.getAdresse()))
                .ville(trimToNull(req.getVille()))
                .nationalite(trimToNull(req.getNationalite()))
                .matricule(trimToNull(req.getMatricule()))
                .typeContrat(req.getTypeContrat())
                .poste(trimToNull(req.getPoste()))
                .departement(trimToNull(req.getDepartement()))
                .dateEmbauche(req.getDateEmbauche())
                .statut(trimToNull(req.getStatut()))
                .nomBanque(trimToNull(req.getNomBanque()))
                .rib(trimToNull(req.getRib()))
                .cnss(trimToNull(req.getCnss()))
                .role(req.getRole())
                .managerId(req.getManagerId() != null && req.getManagerId() > 0 ? req.getManagerId() : null)
                .actif(true)
                .firstLogin(false)
                .createdAt(now)
                .updatedAt(now)
                .build();

        if (u.getRole() == Role.ADMIN || u.getRole() == Role.RH) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Création réservée aux profils employé/manager");
        }
        User saved = userRepository.save(u);
        publishProfileCreated(saved);
        return UserResponse.from(saved);
    }

    @Transactional
    public UserResponse updateEmployee(Long id, EmployeeUpdateRequest req) {
        User u = userRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Employé introuvable"));
        if (u.getRole() == Role.ADMIN) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Action interdite sur ce profil");
        }
        patchEmployee(u, req);
        u.setUpdatedAt(Instant.now());
        return UserResponse.from(userRepository.save(u));
    }

    @Transactional
    public void deactivateEmployee(Long id) {
        User u = userRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Employé introuvable"));
        if (u.getRole() == Role.ADMIN || u.getRole() == Role.RH) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Action interdite");
        }
        u.setActif(false);
        u.setUpdatedAt(Instant.now());
        userRepository.save(u);
    }

    @Transactional
    public UserResponse uploadPhotoRh(Long actorUserId, Long targetId, MultipartFile file) throws IOException {
        assertRh(actorUserId);
        User u = userRepository.findById(targetId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Employé introuvable"));
        String url = fileStorageService.storeUserFile(u.getId(), "photo", file, Set.of("jpg", "jpeg", "png"));
        u.setPhotoUrl(url);
        u.setUpdatedAt(Instant.now());
        return UserResponse.from(userRepository.save(u));
    }

    @Transactional
    public UserResponse uploadCvRh(Long actorUserId, Long targetId, MultipartFile file) throws IOException {
        assertRh(actorUserId);
        User u = userRepository.findById(targetId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Employé introuvable"));
        String url = fileStorageService.storeUserFile(u.getId(), "cv", file, Set.of("pdf"));
        u.setCvUrl(url);
        u.setUpdatedAt(Instant.now());
        return UserResponse.from(userRepository.save(u));
    }

    @Transactional
    public UserResponse uploadPhotoSelf(Long userId, MultipartFile file) throws IOException {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Utilisateur introuvable"));
        String url = fileStorageService.storeUserFile(u.getId(), "photo", file, Set.of("jpg", "jpeg", "png"));
        u.setPhotoUrl(url);
        u.setUpdatedAt(Instant.now());
        return UserResponse.from(userRepository.save(u));
    }

    public List<UserResponse> team(Long managerId) {
        return userRepository.findByActifTrueAndManagerId(managerId).stream().map(UserResponse::from).toList();
    }

    private void patchEmployee(User u, EmployeeUpdateRequest req) {
        if (req.getNom() != null) {
            u.setNom(req.getNom());
        }
        if (req.getPrenom() != null) {
            u.setPrenom(req.getPrenom());
        }
        if (req.getCin() != null) {
            u.setCin(req.getCin());
        }
        if (req.getTelephone() != null) {
            u.setTelephone(req.getTelephone());
        }
        if (req.getDateNaissance() != null) {
            u.setDateNaissance(req.getDateNaissance());
        }
        if (req.getEtatCivil() != null) {
            u.setEtatCivil(req.getEtatCivil());
        }
        if (req.getAdresse() != null) {
            u.setAdresse(req.getAdresse());
        }
        if (req.getVille() != null) {
            u.setVille(req.getVille());
        }
        if (req.getNationalite() != null) {
            u.setNationalite(req.getNationalite());
        }
        if (req.getMatricule() != null) {
            u.setMatricule(req.getMatricule());
        }
        if (req.getTypeContrat() != null) {
            u.setTypeContrat(req.getTypeContrat());
        }
        if (req.getPoste() != null) {
            u.setPoste(req.getPoste());
        }
        if (req.getDepartement() != null) {
            u.setDepartement(req.getDepartement());
        }
        if (req.getDateEmbauche() != null) {
            u.setDateEmbauche(req.getDateEmbauche());
        }
        if (req.getStatut() != null) {
            u.setStatut(req.getStatut());
        }
        if (req.getNomBanque() != null) {
            u.setNomBanque(req.getNomBanque());
        }
        if (req.getRib() != null) {
            u.setRib(req.getRib());
        }
        if (req.getCnss() != null) {
            u.setCnss(req.getCnss());
        }
        if (req.getRole() != null) {
            if (req.getRole() == Role.ADMIN || req.getRole() == Role.RH) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Rôle invalide pour un employé");
            }
            u.setRole(req.getRole());
        }
        if (req.getManagerId() != null) {
            u.setManagerId(req.getManagerId());
        }
    }

    private void assertRh(Long userId) {
        User actor = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));
        if (actor.getRole() != Role.RH) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Accès RH requis");
        }
    }

    private static String emptyToNull(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        return s.trim();
    }

    private static String trimToNull(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        return s.trim();
    }

    private void publishProfileCreated(User user) {
        try {
            accountKafkaProducer.publishProfileCreated(AccountCreatedEvent.builder()
                    .employeeId(user.getId())
                    .email(user.getEmail())
                    .action("PROFILE_CREATED")
                    .build());
        } catch (Exception ignored) {
        }
    }
}
