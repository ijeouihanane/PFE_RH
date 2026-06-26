package ma.pfe.rh.users.service;

import lombok.RequiredArgsConstructor;
import ma.pfe.rh.users.domain.AppraisalCriterion;
import ma.pfe.rh.users.domain.AppraisalGridTemplate;
import ma.pfe.rh.users.dto.AppraisalGridDtos.CriterionInput;
import ma.pfe.rh.users.dto.AppraisalGridDtos.CriterionResponse;
import ma.pfe.rh.users.dto.AppraisalGridDtos.GridDetail;
import ma.pfe.rh.users.dto.AppraisalGridDtos.GridSummary;
import ma.pfe.rh.users.dto.AppraisalGridDtos.PublishRequest;
import ma.pfe.rh.users.repo.AppraisalCriterionRepository;
import ma.pfe.rh.users.repo.AppraisalGridTemplateRepository;
import ma.pfe.rh.users.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
public class AppraisalGridConfigurationService {

    public static final List<String> DEPARTMENTS = List.of(
            "IT", "Marketing", "Finance", "Commercial", "Administration", "RH"
    );

    private final AppraisalGridTemplateRepository gridRepository;
    private final AppraisalCriterionRepository criterionRepository;

    @Transactional(readOnly = true)
    public List<GridSummary> list() {
        return gridRepository.findAllByOrderByDepartmentAscVersionNumberDesc().stream()
                .filter(AppraisalGridTemplate::isActive)
                .map(this::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public GridDetail detail(Long id) {
        return toDetail(requireGrid(id));
    }

    @Transactional(readOnly = true)
    public List<GridSummary> versions(Long id) {
        AppraisalGridTemplate grid = requireGrid(id);
        List<AppraisalGridTemplate> versions = grid.getDepartment() == null
                ? gridRepository.findByDepartmentIsNullOrderByVersionNumberDesc()
                : gridRepository.findByDepartmentIgnoreCaseOrderByVersionNumberDesc(grid.getDepartment());
        return versions.stream().map(this::toSummary).toList();
    }

    @Transactional(readOnly = true)
    public List<String> availableDepartments() {
        Set<String> covered = gridRepository.findAllByOrderByDepartmentAscVersionNumberDesc().stream()
                .filter(AppraisalGridTemplate::isActive)
                .map(AppraisalGridTemplate::getDepartment)
                .filter(value -> value != null && !value.isBlank())
                .map(value -> value.toLowerCase(Locale.ROOT))
                .collect(java.util.stream.Collectors.toSet());
        return DEPARTMENTS.stream()
                .filter(department -> !covered.contains(department.toLowerCase(Locale.ROOT)))
                .toList();
    }

    @Transactional
    public GridDetail create(PublishRequest request) {
        String department = canonicalDepartment(request.department());
        if (gridRepository.existsByDepartmentIgnoreCaseAndActiveTrue(department)) {
            throw new ApiException(HttpStatus.CONFLICT, "Une grille active existe déjà pour ce département");
        }
        validateCriteria(request.criteria());
        return publish(null, department, request.label(), 1, request.criteria());
    }

    @Transactional
    public GridDetail publishVersion(Long sourceId, PublishRequest request) {
        AppraisalGridTemplate source = requireGrid(sourceId);
        if (!source.isActive()) {
            throw new ApiException(HttpStatus.CONFLICT, "Seule la version active peut être configurée");
        }
        String department = source.getDepartment();
        int currentVersion = versionOf(source);
        if (request.expectedVersion() == null || request.expectedVersion() != currentVersion) {
            throw new ApiException(HttpStatus.CONFLICT, "La grille a été modifiée. Rechargez la version active");
        }
        validateCriteria(request.criteria());

        AppraisalGridTemplate locked = (department == null
                ? gridRepository.lockActiveGeneric()
                : gridRepository.lockActiveByDepartment(department))
                .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "Aucune version active trouvée"));
        if (!locked.getId().equals(sourceId) || versionOf(locked) != currentVersion) {
            throw new ApiException(HttpStatus.CONFLICT, "Une nouvelle version a déjà été publiée");
        }
        locked.setActive(false);
        locked.setUpdatedAt(Instant.now());
        gridRepository.save(locked);
        return publish(locked, department, request.label(), currentVersion + 1, request.criteria());
    }

    private GridDetail publish(
            AppraisalGridTemplate previous,
            String department,
            String label,
            int version,
            List<CriterionInput> criteria
    ) {
        Instant now = Instant.now();
        String baseCode = previous != null ? rootCode(previous.getCode()) : normalizeCode(department);
        String code = version == 1 ? baseCode : baseCode + "_V" + version;
        AppraisalGridTemplate grid = gridRepository.save(AppraisalGridTemplate.builder()
                .code(code)
                .label(label.trim())
                .department(department)
                .active(true)
                .versionNumber(version)
                .publishedAt(now)
                .updatedAt(now)
                .createdAt(now)
                .build());

        List<AppraisalCriterion> entities = IntStream.range(0, criteria.size())
                .mapToObj(index -> AppraisalCriterion.builder()
                        .gridTemplate(grid)
                        .label(criteria.get(index).label().trim())
                        .description(criteria.get(index).description().trim())
                        .displayOrder(index + 1)
                        .active(true)
                        .build())
                .toList();
        criterionRepository.saveAll(entities);
        return toDetail(grid);
    }

    private void validateCriteria(List<CriterionInput> criteria) {
        long distinctLabels = criteria.stream()
                .map(item -> item.label().trim().toLowerCase(Locale.ROOT))
                .distinct()
                .count();
        if (distinctLabels != criteria.size()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Les libellés des critères doivent être uniques");
        }
    }

    private AppraisalGridTemplate requireGrid(Long id) {
        return gridRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Grille introuvable"));
    }

    private GridSummary toSummary(AppraisalGridTemplate grid) {
        return new GridSummary(
                grid.getId(),
                grid.getCode(),
                grid.getLabel(),
                grid.getDepartment(),
                versionOf(grid),
                Math.toIntExact(criterionRepository.countByGridTemplateId(grid.getId())),
                grid.isActive(),
                grid.getDepartment() == null,
                publishedAt(grid),
                grid.getUpdatedAt() != null ? grid.getUpdatedAt() : publishedAt(grid)
        );
    }

    private GridDetail toDetail(AppraisalGridTemplate grid) {
        List<CriterionResponse> criteria = criterionRepository
                .findByGridTemplateIdOrderByDisplayOrder(grid.getId()).stream()
                .map(item -> new CriterionResponse(
                        item.getId(),
                        item.getLabel(),
                        item.getDescription(),
                        item.getDisplayOrder()
                ))
                .toList();
        return new GridDetail(
                grid.getId(),
                grid.getCode(),
                grid.getLabel(),
                grid.getDepartment(),
                versionOf(grid),
                grid.isActive(),
                grid.getDepartment() == null,
                publishedAt(grid),
                grid.getUpdatedAt() != null ? grid.getUpdatedAt() : publishedAt(grid),
                criteria
        );
    }

    private String canonicalDepartment(String value) {
        String requested = value == null ? "" : value.trim();
        return DEPARTMENTS.stream()
                .filter(item -> item.equalsIgnoreCase(requested))
                .findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Département non reconnu"));
    }

    private static int versionOf(AppraisalGridTemplate grid) {
        return grid.getVersionNumber() == null ? 1 : grid.getVersionNumber();
    }

    private static Instant publishedAt(AppraisalGridTemplate grid) {
        return grid.getPublishedAt() != null ? grid.getPublishedAt() : grid.getCreatedAt();
    }

    private static String rootCode(String code) {
        return code.replaceFirst("_V\\d+$", "");
    }

    private static String normalizeCode(String value) {
        String ascii = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return ascii.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_") + "_GRID";
    }
}
