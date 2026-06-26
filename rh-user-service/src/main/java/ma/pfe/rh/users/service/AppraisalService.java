package ma.pfe.rh.users.service;

import lombok.RequiredArgsConstructor;
import ma.pfe.rh.users.domain.Appraisal;
import ma.pfe.rh.users.domain.AppraisalCriterion;
import ma.pfe.rh.users.domain.AppraisalCriterionLevel;
import ma.pfe.rh.users.domain.AppraisalCriterionResponse;
import ma.pfe.rh.users.domain.AppraisalGridTemplate;
import ma.pfe.rh.users.domain.AppraisalPerformance;
import ma.pfe.rh.users.domain.AppraisalPotential;
import ma.pfe.rh.users.domain.AppraisalStatus;
import ma.pfe.rh.users.domain.Role;
import ma.pfe.rh.users.domain.User;
import ma.pfe.rh.users.dto.AppraisalAnswerResponse;
import ma.pfe.rh.users.dto.AppraisalContextResponse;
import ma.pfe.rh.users.dto.AppraisalCriterionAnswerRequest;
import ma.pfe.rh.users.dto.AppraisalCriterionDto;
import ma.pfe.rh.users.dto.AppraisalDraftRequest;
import ma.pfe.rh.users.dto.AppraisalResponse;
import ma.pfe.rh.users.repo.AppraisalCriterionRepository;
import ma.pfe.rh.users.repo.AppraisalGridTemplateRepository;
import ma.pfe.rh.users.repo.AppraisalRepository;
import ma.pfe.rh.users.repo.UserRepository;
import ma.pfe.rh.users.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.time.Year;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AppraisalService {

    private static final List<AppraisalStatus> PREVIOUS_VISIBLE_STATUSES = List.of(
            AppraisalStatus.SOUMIS,
            AppraisalStatus.PRISE_CONNAISSANCE,
            AppraisalStatus.VALIDEE_RH
    );

    private final AppraisalRepository appraisalRepository;
    private final AppraisalGridTemplateRepository gridRepository;
    private final AppraisalCriterionRepository criterionRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public AppraisalContextResponse context(Long managerId, Long employeeId) {
        User employee = requireManagedEmployee(managerId, employeeId);
        AppraisalGridTemplate grid = resolveGrid(employee.getDepartement());
        return buildContext(employee, grid);
    }

    @Transactional(readOnly = true)
    public AppraisalContextResponse draftContext(Long managerId, Long appraisalId) {
        Appraisal appraisal = requireManagerAppraisal(managerId, appraisalId);
        assertDraft(appraisal);
        User employee = requireManagedEmployee(managerId, appraisal.getEmployeeId());
        if (appraisal.getGridTemplate() == null) {
            throw new ApiException(HttpStatus.CONFLICT, "Ce brouillon ne possède pas de grille d'évaluation");
        }
        return buildContext(employee, appraisal.getGridTemplate());
    }

    private AppraisalContextResponse buildContext(User employee, AppraisalGridTemplate grid) {
        List<AppraisalCriterionDto> criteria = activeCriteria(grid).stream()
                .map(c -> AppraisalCriterionDto.builder()
                        .id(c.getId())
                        .label(c.getLabel())
                        .description(c.getDescription())
                        .displayOrder(c.getDisplayOrder())
                        .build())
                .toList();

        AppraisalContextResponse.PreviousAppraisal previous = appraisalRepository
                .findFirstByEmployeeIdAndStatutInAndGridTemplateIsNotNullOrderByCreatedAtDesc(
                        employee.getId(),
                        PREVIOUS_VISIBLE_STATUSES
                )
                .map(a -> AppraisalContextResponse.PreviousAppraisal.builder()
                        .periode(a.getPeriode())
                        .positioningCategory(a.getPositioningCategory())
                        .performance(a.getPerformance() != null ? a.getPerformance().name() : null)
                        .build())
                .orElse(null);

        return AppraisalContextResponse.builder()
                .employee(ma.pfe.rh.users.dto.UserResponse.from(employee))
                .anciennete(formatSeniority(employee.getDateEmbauche()))
                .gridTemplateId(grid.getId())
                .gridCode(grid.getCode())
                .gridLabel(grid.getLabel())
                .criteria(criteria)
                .previousAppraisal(previous)
                .defaultPeriod("Annuel " + Year.now().getValue())
                .build();
    }

    @Transactional
    public AppraisalResponse saveDraft(Long managerId, AppraisalDraftRequest request) {
        User employee = requireManagedEmployee(managerId, request.getEmployeeId());
        String period = normalizePeriod(request.getPeriode());
        Appraisal appraisal = appraisalRepository.findByEmployeeIdAndPeriode(employee.getId(), period)
                .map(existing -> {
                    if (!existing.getManagerId().equals(managerId)) {
                        throw new ApiException(HttpStatus.CONFLICT, "Une appréciation existe déjà pour cette période");
                    }
                    assertDraft(existing);
                    return existing;
                })
                .orElseGet(() -> newDraft(managerId, employee, period));

        applyDraft(appraisal, request);
        return toResponse(appraisalRepository.save(appraisal));
    }

    @Transactional
    public AppraisalResponse updateDraft(Long managerId, Long appraisalId, AppraisalDraftRequest request) {
        Appraisal appraisal = requireManagerAppraisal(managerId, appraisalId);
        assertDraft(appraisal);
        if (!appraisal.getEmployeeId().equals(request.getEmployeeId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "L'employé du brouillon ne peut pas être modifié");
        }
        applyDraft(appraisal, request);
        return toResponse(appraisalRepository.save(appraisal));
    }

    @Transactional
    public AppraisalResponse submit(Long managerId, Long appraisalId) {
        Appraisal appraisal = requireManagerAppraisal(managerId, appraisalId);
        assertDraft(appraisal);
        validateComplete(appraisal);

        appraisal.setPositioningCategory(positioning(appraisal.getPerformance(), appraisal.getPotential()));
        if (appraisal.getGeneratedSummary() == null || appraisal.getGeneratedSummary().isBlank()) {
            appraisal.setGeneratedSummary(generateSummary(appraisal));
        }
        appraisal.setCommentaire(appraisal.getGeneratedSummary());
        appraisal.setStatut(AppraisalStatus.SOUMIS);
        appraisal.setSubmittedAt(Instant.now());
        appraisal.setUpdatedAt(Instant.now());
        return toResponse(appraisalRepository.save(appraisal));
    }

    @Transactional(readOnly = true)
    public List<AppraisalResponse> forManager(Long managerId) {
        requireRole(managerId, Role.MANAGER);
        return appraisalRepository.findByManagerIdOrderByCreatedAtDesc(managerId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AppraisalResponse> forEmployee(Long employeeId) {
        return appraisalRepository.findByEmployeeIdOrderByCreatedAtDesc(employeeId).stream()
                .filter(a -> a.getGridTemplate() != null)
                .filter(a -> a.getStatut() != AppraisalStatus.BROUILLON)
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AppraisalResponse> allForRh(Long actorId) {
        requireRole(actorId, Role.RH);
        return appraisalRepository.findAllByOrderByCreatedAtDesc().stream()
                .filter(a -> a.getGridTemplate() != null)
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public AppraisalResponse detail(Long actorId, Role role, Long appraisalId) {
        Appraisal appraisal = requireAppraisal(appraisalId);
        boolean allowed = switch (role) {
            case RH -> true;
            case MANAGER -> appraisal.getManagerId().equals(actorId) || appraisal.getEmployeeId().equals(actorId);
            case EMPLOYEE -> appraisal.getEmployeeId().equals(actorId);
            default -> false;
        };
        if (!allowed) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Accès refusé à cette appréciation");
        }
        if (role == Role.EMPLOYEE && appraisal.getStatut() == AppraisalStatus.BROUILLON) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Cette appréciation n'est pas encore soumise");
        }
        return toResponse(appraisal);
    }

    @Transactional
    public AppraisalResponse acknowledge(Long employeeId, Long appraisalId, String employeeComment) {
        Appraisal appraisal = requireAppraisal(appraisalId);
        if (!appraisal.getEmployeeId().equals(employeeId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Cette appréciation ne vous appartient pas");
        }
        if (appraisal.getStatut() != AppraisalStatus.SOUMIS) {
            throw new ApiException(HttpStatus.CONFLICT, "Cette appréciation ne peut pas être confirmée dans son état actuel");
        }
        appraisal.setEmployeeComment(trimToNull(employeeComment));
        appraisal.setEmployeeAcknowledgedAt(Instant.now());
        appraisal.setUpdatedAt(Instant.now());
        appraisal.setStatut(AppraisalStatus.PRISE_CONNAISSANCE);
        return toResponse(appraisalRepository.save(appraisal));
    }

    @Transactional
    public AppraisalResponse validateRh(Long rhId, Long appraisalId) {
        requireRole(rhId, Role.RH);
        Appraisal appraisal = requireAppraisal(appraisalId);
        if (appraisal.getStatut() != AppraisalStatus.PRISE_CONNAISSANCE) {
            throw new ApiException(HttpStatus.CONFLICT, "La prise de connaissance de l'employé est requise");
        }
        appraisal.setRhValidatedAt(Instant.now());
        appraisal.setUpdatedAt(Instant.now());
        appraisal.setStatut(AppraisalStatus.VALIDEE_RH);
        return toResponse(appraisalRepository.save(appraisal));
    }

    private Appraisal newDraft(Long managerId, User employee, String period) {
        Instant now = Instant.now();
        return Appraisal.builder()
                .employeeId(employee.getId())
                .managerId(managerId)
                .periode(period)
                .objectifsNote(0)
                .competencesNote(0)
                .comportementNote(0)
                .commentaire("")
                .axesAmelioration(null)
                .gridTemplate(resolveGrid(employee.getDepartement()))
                .statut(AppraisalStatus.BROUILLON)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private void applyDraft(Appraisal appraisal, AppraisalDraftRequest request) {
        appraisal.setPerformance(request.getPerformance());
        appraisal.setPotential(request.getPotential());
        appraisal.setManagerComment(trimToNull(request.getManagerComment()));
        appraisal.setPeriode(normalizePeriod(request.getPeriode()));
        appraisal.setUpdatedAt(Instant.now());

        if (request.getPerformance() != null && request.getPotential() != null) {
            appraisal.setPositioningCategory(positioning(request.getPerformance(), request.getPotential()));
        }
        replaceAnswers(appraisal, request.getAnswers());

        if (isComplete(appraisal)) {
            String generated = generateSummary(appraisal);
            String submittedSummary = trimToNull(request.getGeneratedSummary());
            appraisal.setGeneratedSummary(submittedSummary != null ? submittedSummary : generated);
            appraisal.setCommentaire(appraisal.getGeneratedSummary());
        }
    }

    private void replaceAnswers(Appraisal appraisal, List<AppraisalCriterionAnswerRequest> answerRequests) {
        if (answerRequests == null) {
            return;
        }
        List<AppraisalCriterion> criteria = activeCriteria(appraisal.getGridTemplate());
        Map<Long, AppraisalCriterion> allowed = criteria.stream()
                .collect(Collectors.toMap(AppraisalCriterion::getId, Function.identity()));
        Set<Long> requestIds = answerRequests.stream()
                .map(AppraisalCriterionAnswerRequest::getCriterionId)
                .collect(Collectors.toSet());
        if (requestIds.size() != answerRequests.size()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Un critère est présent plusieurs fois");
        }

        appraisal.getCriterionResponses().removeIf(response -> !requestIds.contains(response.getCriterion().getId()));
        Map<Long, AppraisalCriterionResponse> existingResponses = appraisal.getCriterionResponses().stream()
                .collect(Collectors.toMap(response -> response.getCriterion().getId(), Function.identity()));

        for (AppraisalCriterionAnswerRequest answer : answerRequests) {
            AppraisalCriterion criterion = allowed.get(answer.getCriterionId());
            if (criterion == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Critère invalide pour cette grille");
            }
            AppraisalCriterionResponse response = existingResponses.get(criterion.getId());
            if (response == null) {
                response = AppraisalCriterionResponse.builder()
                        .appraisal(appraisal)
                        .criterion(criterion)
                        .build();
                appraisal.getCriterionResponses().add(response);
            }
            response.setLevel(answer.getLevel());
            response.setComment(trimToNull(answer.getComment()));
        }
    }

    private void validateComplete(Appraisal appraisal) {
        if (!isComplete(appraisal)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Tous les critères, la performance et le potentiel sont obligatoires");
        }
        boolean missingComment = appraisal.getCriterionResponses().stream()
                .anyMatch(r -> r.getLevel() == AppraisalCriterionLevel.A_RENFORCER
                        && (r.getComment() == null || r.getComment().isBlank()));
        if (missingComment) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Un commentaire est obligatoire pour chaque critère à renforcer");
        }
    }

    private boolean isComplete(Appraisal appraisal) {
        int expected = activeCriteria(appraisal.getGridTemplate()).size();
        return appraisal.getPerformance() != null
                && appraisal.getPotential() != null
                && appraisal.getCriterionResponses().size() == expected;
    }

    private String generateSummary(Appraisal appraisal) {
        User employee = userRepository.findById(appraisal.getEmployeeId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Employé introuvable"));

        List<String> strengths = appraisal.getCriterionResponses().stream()
                .filter(r -> r.getLevel() == AppraisalCriterionLevel.POINT_FORT)
                .map(r -> r.getCriterion().getLabel())
                .toList();
        List<String> development = appraisal.getCriterionResponses().stream()
                .filter(r -> r.getLevel() == AppraisalCriterionLevel.A_RENFORCER
                        || r.getLevel() == AppraisalCriterionLevel.EN_PROGRESSION)
                .map(r -> r.getCriterion().getLabel())
                .toList();

        String intro = "Durant la période " + appraisal.getPeriode() + ", "
                + employee.getPrenom() + " " + employee.getNom()
                + ", occupant le poste de " + valueOrFallback(employee.getPoste(), "collaborateur")
                + " au sein du département " + valueOrFallback(employee.getDepartement(), "non renseigné")
                + ", a été évalué(e) selon la grille " + appraisal.getGridTemplate().getLabel() + ". ";
        String strengthText = strengths.isEmpty()
                ? "Aucun point fort spécifique n’a été isolé sur cette période. "
                : "Les points forts identifiés concernent " + joinLabels(strengths) + ". ";
        String developmentText = development.isEmpty()
                ? "Aucun axe de développement prioritaire n’a été identifié sur cette période. "
                : "Les axes de développement portent sur " + joinLabels(development) + ". ";
        String positioningText = "La performance actuelle est évaluée comme "
                + performanceLabel(appraisal.getPerformance())
                + ", tandis que le potentiel d’évolution est estimé comme "
                + potentialLabel(appraisal.getPotential())
                + ". Cette combinaison traduit un positionnement RH de type : "
                + positioning(appraisal.getPerformance(), appraisal.getPotential()) + ". ";
        return intro + strengthText + developmentText + positioningText
                + "Cette appréciation constitue une base de discussion pour l’entretien de feedback et le suivi RH.";
    }

    private AppraisalResponse toResponse(Appraisal appraisal) {
        Map<Long, User> users = new HashMap<>();
        userRepository.findAllById(List.of(appraisal.getEmployeeId(), appraisal.getManagerId()))
                .forEach(user -> users.put(user.getId(), user));
        User employee = users.get(appraisal.getEmployeeId());
        User manager = users.get(appraisal.getManagerId());

        List<AppraisalAnswerResponse> answers = appraisal.getCriterionResponses().stream()
                .sorted(Comparator.comparingInt(r -> r.getCriterion().getDisplayOrder()))
                .map(r -> AppraisalAnswerResponse.builder()
                        .criterionId(r.getCriterion().getId())
                        .criterionLabel(r.getCriterion().getLabel())
                        .criterionDescription(r.getCriterion().getDescription())
                        .displayOrder(r.getCriterion().getDisplayOrder())
                        .level(r.getLevel())
                        .comment(r.getComment())
                        .build())
                .toList();

        return AppraisalResponse.builder()
                .id(appraisal.getId())
                .employeeId(appraisal.getEmployeeId())
                .managerId(appraisal.getManagerId())
                .employeeName(fullName(employee))
                .managerName(fullName(manager))
                .employeeDepartment(employee != null ? employee.getDepartement() : null)
                .employeePoste(employee != null ? employee.getPoste() : null)
                .periode(appraisal.getPeriode())
                .gridTemplateId(appraisal.getGridTemplate() != null ? appraisal.getGridTemplate().getId() : null)
                .gridLabel(appraisal.getGridTemplate() != null ? appraisal.getGridTemplate().getLabel() : null)
                .performance(appraisal.getPerformance())
                .potential(appraisal.getPotential())
                .positioningCategory(appraisal.getPositioningCategory())
                .generatedSummary(appraisal.getGeneratedSummary())
                .managerComment(appraisal.getManagerComment())
                .employeeComment(appraisal.getEmployeeComment())
                .statut(appraisal.getStatut())
                .createdAt(appraisal.getCreatedAt())
                .updatedAt(appraisal.getUpdatedAt())
                .submittedAt(appraisal.getSubmittedAt())
                .employeeAcknowledgedAt(appraisal.getEmployeeAcknowledgedAt())
                .rhValidatedAt(appraisal.getRhValidatedAt())
                .answers(answers)
                .build();
    }

    private User requireManagedEmployee(Long managerId, Long employeeId) {
        requireRole(managerId, Role.MANAGER);
        User employee = userRepository.findById(employeeId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Employé introuvable"));
        if (!employee.isActif()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Employé inactif");
        }
        if (employee.getManagerId() == null || !employee.getManagerId().equals(managerId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Cet employé n'appartient pas à votre équipe");
        }
        return employee;
    }

    private Appraisal requireManagerAppraisal(Long managerId, Long appraisalId) {
        requireRole(managerId, Role.MANAGER);
        return appraisalRepository.findByIdAndManagerId(appraisalId, managerId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Appréciation introuvable"));
    }

    private Appraisal requireAppraisal(Long appraisalId) {
        return appraisalRepository.findById(appraisalId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Appréciation introuvable"));
    }

    private void requireRole(Long userId, Role role) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Utilisateur introuvable"));
        if (user.getRole() != role) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Accès " + role + " requis");
        }
    }

    private AppraisalGridTemplate resolveGrid(String department) {
        if (department != null && !department.isBlank()) {
            var specific = gridRepository.findFirstByDepartmentIgnoreCaseAndActiveTrue(department.trim());
            if (specific.isPresent()) {
                return specific.get();
            }
        }
        return gridRepository.findFirstByDepartmentIsNullAndActiveTrue()
                .orElseThrow(() -> new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Grille générique non configurée"));
    }

    private List<AppraisalCriterion> activeCriteria(AppraisalGridTemplate grid) {
        return criterionRepository.findByGridTemplateIdAndActiveTrueOrderByDisplayOrder(grid.getId());
    }

    private static void assertDraft(Appraisal appraisal) {
        if (appraisal.getStatut() != AppraisalStatus.BROUILLON) {
            throw new ApiException(HttpStatus.CONFLICT, "Une appréciation finalisée existe déjà pour cette période");
        }
    }

    private static String positioning(AppraisalPerformance performance, AppraisalPotential potential) {
        return switch (performance) {
            case SUPERIEURE -> switch (potential) {
                case FORT -> "Talent clé";
                case EVOLUTIF -> "Contributeur solide";
                case A_CONFIRMER -> "Contributeur à soutenir";
            };
            case CONFORME -> switch (potential) {
                case FORT -> "Profil à promouvoir";
                case EVOLUTIF -> "Collaborateur solide";
                case A_CONFIRMER -> "Profil à observer";
            };
            case A_RENFORCER -> switch (potential) {
                case FORT -> "Potentiel inexploité";
                case EVOLUTIF -> "À redresser";
                case A_CONFIRMER -> "Sous-performance";
            };
        };
    }

    private static String performanceLabel(AppraisalPerformance performance) {
        return switch (performance) {
            case A_RENFORCER -> "À renforcer";
            case CONFORME -> "Conforme aux attentes";
            case SUPERIEURE -> "Supérieure aux attentes";
        };
    }

    private static String potentialLabel(AppraisalPotential potential) {
        return switch (potential) {
            case A_CONFIRMER -> "À confirmer";
            case EVOLUTIF -> "Évolutif";
            case FORT -> "Fort potentiel";
        };
    }

    private static String formatSeniority(LocalDate startDate) {
        if (startDate == null) {
            return "Non renseignée";
        }
        Period period = Period.between(startDate, LocalDate.now());
        if (period.isNegative()) {
            return "0 mois";
        }
        String years = period.getYears() > 0 ? period.getYears() + " an" + (period.getYears() > 1 ? "s" : "") : "";
        String months = period.getMonths() > 0 ? period.getMonths() + " mois" : "";
        String result = (years + " " + months).trim();
        return result.isBlank() ? "Moins d'un mois" : result;
    }

    private static String normalizePeriod(String period) {
        String value = period == null ? "" : period.trim();
        if (value.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La période est obligatoire");
        }
        return value;
    }

    private static String joinLabels(List<String> labels) {
        if (labels.size() == 1) {
            return labels.getFirst();
        }
        return String.join(", ", labels.subList(0, labels.size() - 1))
                + " et " + labels.getLast();
    }

    private static String fullName(User user) {
        return user == null ? null : user.getPrenom() + " " + user.getNom();
    }

    private static String valueOrFallback(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private static String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
