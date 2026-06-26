package ma.pfe.rh.leaves.service;

import lombok.RequiredArgsConstructor;
import ma.pfe.rh.leaves.domain.LeaveBalance;
import ma.pfe.rh.leaves.domain.LeaveHistory;
import ma.pfe.rh.leaves.domain.LeaveRequest;
import ma.pfe.rh.leaves.domain.LeaveStatus;
import ma.pfe.rh.leaves.domain.LeaveType;
import ma.pfe.rh.leaves.dto.CommentDto;
import ma.pfe.rh.leaves.dto.LeaveBalanceResponse;
import ma.pfe.rh.leaves.dto.LeaveHistoryResponse;
import ma.pfe.rh.leaves.dto.LeaveRequestCreateDto;
import ma.pfe.rh.leaves.dto.LeaveRequestResponse;
import ma.pfe.rh.leaves.integration.UserDirectory;
import ma.pfe.rh.leaves.kafka.LeaveKafkaProducer;
import ma.pfe.rh.leaves.repo.LeaveBalanceRepository;
import ma.pfe.rh.leaves.repo.LeaveHistoryRepository;
import ma.pfe.rh.leaves.repo.LeaveRequestRepository;
import ma.pfe.rh.leaves.web.ApiException;
import ma.pfe.rh.leaves.web.security.Role;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LeaveService {

    private static final int DEFAULT_ANNUAL_BALANCE = 26;
    private static final Set<LeaveStatus> BLOCKING_STATUSES = Set.of(
            LeaveStatus.EN_ATTENTE_MANAGER,
            LeaveStatus.EN_ATTENTE_RH,
            LeaveStatus.APPROUVE
    );

    private final LeaveRequestRepository leaveRequestRepository;
    private final LeaveBalanceRepository leaveBalanceRepository;
    private final LeaveHistoryRepository leaveHistoryRepository;
    private final UserDirectory userDirectory;
    private final LeaveKafkaProducer kafkaProducer;
    private final HolidayService holidayService;

    public LeaveBalanceResponse balanceForEmployee(long employeeId, Integer annee) {
        int year = annee != null ? annee : LocalDate.now().getYear();
        LeaveBalance b = ensureBalance(employeeId, year);
        return LeaveBalanceResponse.from(b);
    }

    public LeaveRequestResponse detail(long id) {
        return LeaveRequestResponse.from(load(id));
    }

    public List<LeaveHistoryResponse> history(long id) {
        return leaveHistoryRepository.findByLeaveRequestIdOrderByCreatedAtAsc(id).stream()
                .map(LeaveHistoryResponse::from)
                .toList();
    }

    public List<LeaveRequestResponse> myRequests(long employeeId) {
        return leaveRequestRepository.findByEmployeeIdOrderByCreatedAtDesc(employeeId).stream()
                .map(LeaveRequestResponse::from)
                .toList();
    }

    public List<LeaveRequestResponse> managerPending(long managerId) {
        return leaveRequestRepository.findByManagerIdAndStatutOrderByCreatedAtDesc(managerId, LeaveStatus.EN_ATTENTE_MANAGER)
                .stream()
                .map(LeaveRequestResponse::from)
                .toList();
    }

    public List<LeaveRequestResponse> rhQueue() {
        return leaveRequestRepository.findByStatutOrderByCreatedAtDesc(LeaveStatus.EN_ATTENTE_RH).stream()
                .map(LeaveRequestResponse::from)
                .toList();
    }

    public List<LeaveRequestResponse> rhSearch(Long employeeId, LeaveStatus statut, LeaveType type) {
        if (employeeId != null && statut != null) {
            return leaveRequestRepository.findByEmployeeIdOrderByCreatedAtDesc(employeeId).stream()
                    .filter(r -> r.getStatut() == statut)
                    .filter(r -> type == null || r.getTypeConge() == type)
                    .map(LeaveRequestResponse::from)
                    .toList();
        }
        if (statut != null && type != null) {
            return leaveRequestRepository.findByStatutAndTypeCongeOrderByCreatedAtDesc(statut, type).stream()
                    .map(LeaveRequestResponse::from)
                    .toList();
        }
        if (statut != null) {
            return leaveRequestRepository.findByStatutOrderByCreatedAtDesc(statut).stream()
                    .map(LeaveRequestResponse::from)
                    .toList();
        }
        return leaveRequestRepository.findAll().stream()
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .filter(r -> type == null || r.getTypeConge() == type)
                .map(LeaveRequestResponse::from)
                .toList();
    }

    public Map<String, Long> rhDashboard() {
        Map<String, Long> m = new HashMap<>();
        m.put("pendingManager", leaveRequestRepository.countByStatut(LeaveStatus.EN_ATTENTE_MANAGER));
        m.put("pendingRh", leaveRequestRepository.countByStatut(LeaveStatus.EN_ATTENTE_RH));
        m.put("approved", leaveRequestRepository.countByStatut(LeaveStatus.APPROUVE));
        m.put("refused", leaveRequestRepository.countByStatut(LeaveStatus.REFUSE));
        m.put("cancelled", leaveRequestRepository.countByStatut(LeaveStatus.ANNULE));
        return m;
    }

    public List<LeaveRequestResponse> teamApprovedUpcoming(long managerId, LocalDate from) {
        LocalDate start = from != null ? from : LocalDate.now();
        return leaveRequestRepository.findByManagerIdAndStatutOrderByCreatedAtDesc(managerId, LeaveStatus.APPROUVE).stream()
                .filter(r -> !r.getDateFin().isBefore(start))
                .map(LeaveRequestResponse::from)
                .toList();
    }

    public List<LeaveRequestResponse> teamSearch(long managerId, LeaveStatus statut) {
        if (statut != null) {
            return leaveRequestRepository.findByManagerIdAndStatutOrderByCreatedAtDesc(managerId, statut).stream()
                    .map(LeaveRequestResponse::from)
                    .toList();
        }
        return leaveRequestRepository.findByManagerIdOrderByCreatedAtDesc(managerId).stream()
                .map(LeaveRequestResponse::from)
                .toList();
    }

    @Transactional
    public LeaveRequestResponse create(long employeeId, Role role, LeaveRequestCreateDto dto) {
        if (role != Role.EMPLOYEE && role != Role.MANAGER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Seuls les employes et managers peuvent soumettre une demande");
        }
        if (dto.getDateFin().isBefore(dto.getDateDebut())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Periode invalide");
        }

        HolidayService.LeaveDayCalculation calc = holidayService.calculate(dto.getDateDebut(), dto.getDateFin());
        validateTypeRules(dto.getTypeConge(), calc.joursOuvres(), dto.getMotif(), dto.getJustificatifName());
        validateOverlap(employeeId, dto.getDateDebut(), dto.getDateFin());

        Long managerId = userDirectory.findManagerId(employeeId);

        if (dto.getTypeConge() == LeaveType.ANNUEL) {
            LeaveBalance b = ensureBalance(employeeId, dto.getDateDebut().getYear());
            if (b.getJoursRestants() < calc.joursOuvres()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Solde de conges annuels insuffisant");
            }
        }

        Instant now = Instant.now();
        LeaveStatus initialStatus = managerId == null ? LeaveStatus.EN_ATTENTE_RH : LeaveStatus.EN_ATTENTE_MANAGER;
        LeaveRequest req = LeaveRequest.builder()
                .employeeId(employeeId)
                .typeConge(normalizeType(dto.getTypeConge()))
                .dateDebut(dto.getDateDebut())
                .dateFin(dto.getDateFin())
                .nbJours(calc.joursOuvres())
                .joursCalendaires(calc.joursCalendaires())
                .weekendsExclus(calc.weekendsExclus())
                .joursFeriesExclus(calc.joursFeriesExclus())
                .statut(initialStatus)
                .motif(trimToNull(dto.getMotif()))
                .managerId(managerId)
                .justificatifName(trimToNull(dto.getJustificatifName()))
                .justificatifUrl(trimToNull(dto.getJustificatifUrl()))
                .justificatifType(trimToNull(dto.getJustificatifType()))
                .createdAt(now)
                .updatedAt(now)
                .build();
        LeaveRequest saved = leaveRequestRepository.save(req);
        addHistory(saved.getId(), employeeId, role.name(), "DEMANDE_SOUMISE", null, saved.getStatut(), null);

        Map<String, Object> payload = new HashMap<>();
        payload.put("requestId", saved.getId());
        payload.put("employeeId", saved.getEmployeeId());
        payload.put("managerId", saved.getManagerId());
        payload.put("type", saved.getTypeConge().name());
        kafkaProducer.publish(LeaveKafkaProducer.TOPIC_REQUESTED, String.valueOf(saved.getId()), payload);

        return LeaveRequestResponse.from(saved);
    }

    @Transactional
    public LeaveRequestResponse attach(long actorId, long requestId, MultipartFile file) {
        LeaveRequest r = load(requestId);
        if (!r.getEmployeeId().equals(actorId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Demande hors perimetre");
        }
        AttachmentMeta meta = storeAttachment(file);
        r.setJustificatifName(meta.name());
        r.setJustificatifUrl(meta.url());
        r.setJustificatifType(meta.type());
        r.setUpdatedAt(Instant.now());
        leaveRequestRepository.save(r);
        addHistory(r.getId(), actorId, "EMPLOYEE", "JUSTIFICATIF_AJOUTE", r.getStatut(), r.getStatut(), meta.name());
        return LeaveRequestResponse.from(r);
    }

    @Transactional
    public LeaveRequestResponse managerApprove(long managerId, long requestId) {
        LeaveRequest r = load(requestId);
        requireStatus(r, LeaveStatus.EN_ATTENTE_MANAGER);
        requireManagerScope(r, managerId);
        LeaveStatus old = r.getStatut();
        r.setStatut(LeaveStatus.EN_ATTENTE_RH);
        r.setUpdatedAt(Instant.now());
        leaveRequestRepository.save(r);
        addHistory(r.getId(), managerId, "MANAGER", "VALIDATION_MANAGER", old, r.getStatut(), null);

        Map<String, Object> payload = new HashMap<>();
        payload.put("requestId", r.getId());
        payload.put("employeeId", r.getEmployeeId());
        payload.put("managerId", managerId);
        kafkaProducer.publish(LeaveKafkaProducer.TOPIC_MANAGER_APPROVED, String.valueOf(r.getId()), payload);

        return LeaveRequestResponse.from(r);
    }

    @Transactional
    public LeaveRequestResponse managerReject(long managerId, long requestId, CommentDto dto) {
        LeaveRequest r = load(requestId);
        requireStatus(r, LeaveStatus.EN_ATTENTE_MANAGER);
        requireManagerScope(r, managerId);
        LeaveStatus old = r.getStatut();
        String comment = dto == null ? null : trimToNull(dto.getCommentaire());
        r.setStatut(LeaveStatus.REFUSE);
        r.setCommentaireManager(comment);
        r.setUpdatedAt(Instant.now());
        leaveRequestRepository.save(r);
        addHistory(r.getId(), managerId, "MANAGER", "REFUS_MANAGER", old, r.getStatut(), comment);

        Map<String, Object> payload = new HashMap<>();
        payload.put("requestId", r.getId());
        payload.put("employeeId", r.getEmployeeId());
        payload.put("by", "MANAGER");
        kafkaProducer.publish(LeaveKafkaProducer.TOPIC_REJECTED, String.valueOf(r.getId()), payload);

        return LeaveRequestResponse.from(r);
    }

    @Transactional
    public LeaveRequestResponse rhApprove(long rhUserId, long requestId) {
        LeaveRequest r = load(requestId);
        requireStatus(r, LeaveStatus.EN_ATTENTE_RH);
        validateRequiredAttachmentAtRh(r);
        LeaveStatus old = r.getStatut();
        r.setStatut(LeaveStatus.APPROUVE);
        r.setRhId(rhUserId);
        r.setUpdatedAt(Instant.now());

        if (r.getTypeConge() == LeaveType.ANNUEL) {
            decrementAnnualBalance(r);
        }

        leaveRequestRepository.save(r);
        addHistory(r.getId(), rhUserId, "RH", "VALIDATION_RH", old, r.getStatut(), null);

        Map<String, Object> payload = new HashMap<>();
        payload.put("requestId", r.getId());
        payload.put("employeeId", r.getEmployeeId());
        kafkaProducer.publish(LeaveKafkaProducer.TOPIC_APPROVED, String.valueOf(r.getId()), payload);

        return LeaveRequestResponse.from(r);
    }

    @Transactional
    public LeaveRequestResponse rhReject(long rhUserId, long requestId, CommentDto dto) {
        LeaveRequest r = load(requestId);
        requireStatus(r, LeaveStatus.EN_ATTENTE_RH);
        LeaveStatus old = r.getStatut();
        String comment = dto == null ? null : trimToNull(dto.getCommentaire());
        r.setStatut(LeaveStatus.REFUSE);
        r.setRhId(rhUserId);
        r.setCommentaireRh(comment);
        r.setUpdatedAt(Instant.now());
        leaveRequestRepository.save(r);
        addHistory(r.getId(), rhUserId, "RH", "REFUS_RH", old, r.getStatut(), comment);

        Map<String, Object> payload = new HashMap<>();
        payload.put("requestId", r.getId());
        payload.put("employeeId", r.getEmployeeId());
        payload.put("by", "RH");
        kafkaProducer.publish(LeaveKafkaProducer.TOPIC_REJECTED, String.valueOf(r.getId()), payload);

        return LeaveRequestResponse.from(r);
    }

    @Transactional
    public LeaveRequestResponse cancel(long employeeId, long requestId) {
        LeaveRequest r = load(requestId);
        if (!r.getEmployeeId().equals(employeeId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Demande hors perimetre");
        }
        if (r.getStatut() != LeaveStatus.EN_ATTENTE_MANAGER && r.getStatut() != LeaveStatus.EN_ATTENTE_RH) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Impossible d'annuler cette demande");
        }
        LeaveStatus old = r.getStatut();
        r.setStatut(LeaveStatus.ANNULE);
        r.setCancelledAt(Instant.now());
        r.setCancelledBy(employeeId);
        r.setUpdatedAt(Instant.now());
        leaveRequestRepository.save(r);
        addHistory(r.getId(), employeeId, "EMPLOYEE", "ANNULATION_DEMANDEUR", old, r.getStatut(), null);
        return LeaveRequestResponse.from(r);
    }

    @Transactional
    public LeaveRequestResponse rhCancel(long rhUserId, long requestId, CommentDto dto) {
        LeaveRequest r = load(requestId);
        requireStatus(r, LeaveStatus.APPROUVE);
        if (!r.getDateDebut().isAfter(LocalDate.now())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Seul un conge approuve futur peut etre annule par RH");
        }
        LeaveStatus old = r.getStatut();
        if (r.getTypeConge() == LeaveType.ANNUEL) {
            restoreAnnualBalance(r);
        }
        String comment = dto == null ? null : trimToNull(dto.getCommentaire());
        r.setStatut(LeaveStatus.ANNULE);
        r.setCancelledAt(Instant.now());
        r.setCancelledBy(rhUserId);
        r.setCancelReason(comment);
        r.setUpdatedAt(Instant.now());
        leaveRequestRepository.save(r);
        addHistory(r.getId(), rhUserId, "RH", "ANNULATION_RH", old, r.getStatut(), comment);
        return LeaveRequestResponse.from(r);
    }

    private void validateOverlap(long employeeId, LocalDate start, LocalDate end) {
        List<LeaveRequest> overlaps = leaveRequestRepository
                .findByEmployeeIdAndStatutInAndDateDebutLessThanEqualAndDateFinGreaterThanEqual(employeeId, BLOCKING_STATUSES, end, start);
        if (!overlaps.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Une demande active chevauche deja cette periode");
        }
    }

    private void decrementAnnualBalance(LeaveRequest r) {
        LeaveBalance b = ensureBalance(r.getEmployeeId(), r.getDateDebut().getYear());
        int used = b.getJoursUtilises() + r.getNbJours();
        int rest = b.getSoldeAnnuel() - used;
        if (rest < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Solde annuel incoherent");
        }
        b.setJoursUtilises(used);
        b.setJoursRestants(rest);
        leaveBalanceRepository.save(b);
    }

    private void restoreAnnualBalance(LeaveRequest r) {
        LeaveBalance b = ensureBalance(r.getEmployeeId(), r.getDateDebut().getYear());
        int used = Math.max(0, b.getJoursUtilises() - r.getNbJours());
        b.setJoursUtilises(used);
        b.setJoursRestants(Math.min(b.getSoldeAnnuel(), b.getSoldeAnnuel() - used));
        leaveBalanceRepository.save(b);
    }

    private LeaveRequest load(long id) {
        return leaveRequestRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Demande introuvable"));
    }

    private LeaveBalance ensureBalance(long employeeId, int year) {
        return leaveBalanceRepository.findByEmployeeIdAndAnnee(employeeId, year).orElseGet(() ->
                leaveBalanceRepository.save(LeaveBalance.builder()
                        .employeeId(employeeId)
                        .annee(year)
                        .soldeAnnuel(DEFAULT_ANNUAL_BALANCE)
                        .joursUtilises(0)
                        .joursRestants(DEFAULT_ANNUAL_BALANCE)
                        .build())
        );
    }

    private void validateTypeRules(LeaveType rawType, int nbJours, String motif, String justificatifName) {
        LeaveType type = normalizeType(rawType);
        if (nbJours <= 0 && type != LeaveType.MATERNITE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La periode ne contient aucun jour ouvrable deductible");
        }
        switch (type) {
            case MATERNITE -> {
                if (ChronoUnit.DAYS.between(LocalDate.now(), LocalDate.now().plusDays(nbJours)) > 98 || nbJours > 98) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "Le conge maternite ne peut pas depasser 98 jours");
                }
                requireAttachment(justificatifName, "Un justificatif medical est requis pour le conge maternite");
            }
            case PATERNITE, PATERNITE_NAISSANCE -> requireMax(nbJours, 3, "Le conge naissance / paternite est limite a 3 jours");
            case MARIAGE_SALARIE -> requireMax(nbJours, 4, "Le conge mariage salarie est limite a 4 jours");
            case MARIAGE_ENFANT -> requireMax(nbJours, 2, "Le conge mariage enfant est limite a 2 jours");
            case DECES -> requireMax(nbJours, 3, "Le conge deces est limite a 3 jours");
            case MALADIE -> requireAttachment(justificatifName, "Un certificat est requis pour un conge maladie");
            case SANS_SOLDE -> {
                if (motif == null || motif.isBlank()) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "Le motif est requis pour un conge sans solde");
                }
            }
            default -> {
            }
        }
    }

    private void validateRequiredAttachmentAtRh(LeaveRequest r) {
        if ((r.getTypeConge() == LeaveType.MALADIE || r.getTypeConge() == LeaveType.MATERNITE)
                && (r.getJustificatifName() == null || r.getJustificatifName().isBlank())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Justificatif obligatoire manquant");
        }
    }

    private static void requireMax(int nbJours, int max, String message) {
        if (nbJours > max) {
            throw new ApiException(HttpStatus.BAD_REQUEST, message);
        }
    }

    private static void requireAttachment(String justificatifName, String message) {
        if (justificatifName == null || justificatifName.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, message);
        }
    }

    private static LeaveType normalizeType(LeaveType type) {
        return type == LeaveType.PATERNITE ? LeaveType.PATERNITE_NAISSANCE : type;
    }

    private void requireStatus(LeaveRequest r, LeaveStatus status) {
        if (r.getStatut() != status) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Statut invalide pour cette action");
        }
    }

    private void requireManagerScope(LeaveRequest r, long managerId) {
        if (r.getManagerId() == null || !r.getManagerId().equals(managerId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Demande hors perimetre");
        }
    }

    private void addHistory(Long requestId, Long actorId, String actorRole, String action, LeaveStatus oldStatus, LeaveStatus newStatus, String comment) {
        leaveHistoryRepository.save(LeaveHistory.builder()
                .leaveRequestId(requestId)
                .actorId(actorId)
                .actorRole(actorRole)
                .action(action)
                .oldStatus(oldStatus)
                .newStatus(newStatus)
                .commentaire(trimToNull(comment))
                .createdAt(Instant.now())
                .build());
    }

    public AttachmentMeta storeAttachment(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Justificatif manquant");
        }
        try {
            Path dir = Paths.get("uploads", "leaves").toAbsolutePath().normalize();
            Files.createDirectories(dir);
            String original = file.getOriginalFilename() == null ? "justificatif" : file.getOriginalFilename();
            String safeName = original.replaceAll("[^a-zA-Z0-9._-]", "_");
            String stored = UUID.randomUUID() + "-" + safeName;
            Path target = dir.resolve(stored);
            file.transferTo(target);
            return new AttachmentMeta(original, "/uploads/leaves/" + stored, file.getContentType());
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Enregistrement du justificatif impossible");
        }
    }

    public record AttachmentMeta(String name, String url, String type) {
    }

    private static String trimToNull(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        return s.trim();
    }
}
