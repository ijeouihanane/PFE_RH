package ma.pfe.rh.documents.service;

import lombok.RequiredArgsConstructor;
import ma.pfe.rh.documents.domain.ContractEntity;
import ma.pfe.rh.documents.domain.ContractStatus;
import ma.pfe.rh.documents.domain.ContractType;
import ma.pfe.rh.documents.dto.ContractCreateDto;
import ma.pfe.rh.documents.dto.ContractResponse;
import ma.pfe.rh.documents.dto.ContractUpdateDto;
import ma.pfe.rh.documents.repo.ContractRepository;
import ma.pfe.rh.documents.storage.FileStorageService;
import ma.pfe.rh.documents.web.ApiException;
import ma.pfe.rh.documents.web.security.Role;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ContractService {

    private final ContractRepository contractRepository;
    private final ContractPdfService contractPdfService;
    private final FileStorageService fileStorageService;

    // ─── Lecture ─────────────────────────────────────────────────────────────

    /**
     * Liste tous les contrats avec filtres optionnels.
     * @param type     null = tous
     * @param status   null = tous
     * @param employeeId null = tous
     */
    public List<ContractResponse> list(ContractType type, ContractStatus status, Long employeeId) {
        List<ContractEntity> entities;

        if (employeeId != null) {
            entities = contractRepository.findByEmployeeIdOrderByCreatedAtDesc(employeeId);
            if (type != null) {
                entities = entities.stream().filter(c -> c.getType() == type).toList();
            }
            if (status != null) {
                entities = entities.stream().filter(c -> c.getStatus() == status).toList();
            }
        } else if (type != null && status != null) {
            entities = contractRepository.findByTypeAndStatusOrderByCreatedAtDesc(type, status);
        } else if (type != null) {
            entities = contractRepository.findByTypeOrderByCreatedAtDesc(type);
        } else if (status != null) {
            entities = contractRepository.findByStatusOrderByCreatedAtDesc(status);
        } else {
            entities = contractRepository.findAllByOrderByCreatedAtDesc();
        }

        return entities.stream().map(ContractResponse::from).toList();
    }

    public ContractResponse getById(Long id) {
        return ContractResponse.from(findOrThrow(id));
    }

    // ─── Création ─────────────────────────────────────────────────────────────

    @Transactional
    public ContractResponse createDraft(Long rhUserId, ContractCreateDto dto) {
        validateCreate(dto);

        Instant now = Instant.now();
        ContractEntity entity = ContractEntity.builder()
                .employeeId(dto.getEmployeeId())
                .employeeFullName(dto.getEmployeeFullName())
                .employeeMatricule(dto.getEmployeeMatricule())
                .employeeCin(dto.getEmployeeCin())
                .employeePoste(dto.getEmployeePoste())
                .employeeDepartement(dto.getEmployeeDepartement())
                .employeeEmail(dto.getEmployeeEmail())
                .employeeHireDate(dto.getEmployeeHireDate())
                .type(dto.getType())
                .status(ContractStatus.BROUILLON)
                .startDate(dto.getStartDate())
                .endDate(dto.getEndDate())
                .workplace(dto.getWorkplace())
                .signaturePlace(dto.getSignaturePlace())
                .signatureDate(dto.getSignatureDate())
                .trialPeriod(dto.getTrialPeriod())
                .noticePeriod(dto.getNoticePeriod())
                .baseSalary(dto.getBaseSalary())
                .fixedBonus(dto.getFixedBonus())
                .formDataJson(dto.getFormDataJson())
                .clausesJson(dto.getClausesJson())
                .createdBy(rhUserId)
                .createdAt(now)
                .updatedAt(now)
                .build();

        return ContractResponse.from(contractRepository.save(entity));
    }

    // ─── Modification ─────────────────────────────────────────────────────────

    @Transactional
    public ContractResponse update(Long rhUserId, Long id, ContractUpdateDto dto) {
        ContractEntity entity = findOrThrow(id);
        requireBrouillon(entity);

        Instant now = Instant.now();

        if (dto.getType() != null)               entity.setType(dto.getType());
        if (dto.getEmployeeId() != null)          entity.setEmployeeId(dto.getEmployeeId());
        if (dto.getEmployeeFullName() != null)     entity.setEmployeeFullName(dto.getEmployeeFullName());
        if (dto.getEmployeeMatricule() != null)    entity.setEmployeeMatricule(dto.getEmployeeMatricule());
        if (dto.getEmployeeCin() != null)          entity.setEmployeeCin(dto.getEmployeeCin());
        if (dto.getEmployeePoste() != null)        entity.setEmployeePoste(dto.getEmployeePoste());
        if (dto.getEmployeeDepartement() != null)  entity.setEmployeeDepartement(dto.getEmployeeDepartement());
        if (dto.getEmployeeEmail() != null)        entity.setEmployeeEmail(dto.getEmployeeEmail());
        if (dto.getEmployeeHireDate() != null)     entity.setEmployeeHireDate(dto.getEmployeeHireDate());
        if (dto.getStartDate() != null)            entity.setStartDate(dto.getStartDate());
        // endDate explicitement remis à null si CDI (passage CDI↔CDD)
        entity.setEndDate(dto.getEndDate());
        if (dto.getWorkplace() != null)            entity.setWorkplace(dto.getWorkplace());
        if (dto.getSignaturePlace() != null)       entity.setSignaturePlace(dto.getSignaturePlace());
        if (dto.getSignatureDate() != null)        entity.setSignatureDate(dto.getSignatureDate());
        if (dto.getTrialPeriod() != null)          entity.setTrialPeriod(dto.getTrialPeriod());
        if (dto.getNoticePeriod() != null)         entity.setNoticePeriod(dto.getNoticePeriod());
        if (dto.getBaseSalary() != null)           entity.setBaseSalary(dto.getBaseSalary());
        if (dto.getFixedBonus() != null)           entity.setFixedBonus(dto.getFixedBonus());
        if (dto.getFormDataJson() != null)         entity.setFormDataJson(dto.getFormDataJson());
        if (dto.getClausesJson() != null)          entity.setClausesJson(dto.getClausesJson());

        entity.setUpdatedAt(now);
        return ContractResponse.from(contractRepository.save(entity));
    }

    // ─── Suppression ──────────────────────────────────────────────────────────

    @Transactional
    public void delete(Long rhUserId, Long id) {
        ContractEntity entity = findOrThrow(id);

        // Si contrat GENERE avec un PDF stocké, supprimer le fichier physique
        if (entity.getStatus() == ContractStatus.GENERE && entity.getPdfUrl() != null) {
            try {
                java.nio.file.Path pdfPath = resolveUploadPath(entity.getPdfUrl());
                java.nio.file.Files.deleteIfExists(pdfPath);
            } catch (Exception e) {
                // La suppression du fichier échoue silencieusement ;
                // on supprime quand même l'entité en base.
            }
        }

        contractRepository.delete(entity);
    }

    // ─── Génération PDF ───────────────────────────────────────────────────────

    @Transactional
    public ContractResponse generate(Long rhUserId, Long id) {
        ContractEntity entity = findOrThrow(id);
        requireBrouillon(entity);

        // 1. Rendu HTML final (snapshot immuable)
        String renderedHtml = contractPdfService.renderHtml(entity);
        entity.setRenderedHtml(renderedHtml);

        // 2. Conversion HTML → PDF
        byte[] pdfBytes = contractPdfService.htmlToPdf(renderedHtml);

        // 3. Stockage sur disque
        try {
            String pdfUrl = fileStorageService.storeContractPdf(
                    entity.getEmployeeId(), entity.getId(), pdfBytes);
            entity.setPdfUrl(pdfUrl);
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors de la sauvegarde du PDF : " + e.getMessage(), e);
        }

        // 4. Passage en statut GENERE
        Instant now = Instant.now();
        entity.setStatus(ContractStatus.GENERE);
        entity.setGeneratedAt(now);
        entity.setUpdatedAt(now);

        return ContractResponse.from(contractRepository.save(entity));
    }

    // ─── Téléchargement PDF ───────────────────────────────────────────────────

    /**
     * Retourne les bytes du PDF stocké pour un contrat GENERE.
     * Le fichier est lu depuis le disque à l'emplacement pdfUrl.
     */
    public byte[] downloadPdf(Long id) {
        ContractEntity entity = findOrThrow(id);
        if (entity.getStatus() != ContractStatus.GENERE || entity.getPdfUrl() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Ce contrat n'a pas encore de PDF généré");
        }
        try {
            java.nio.file.Path path = resolveUploadPath(entity.getPdfUrl());
            return java.nio.file.Files.readAllBytes(path);
        } catch (Exception e) {
            throw new RuntimeException("Fichier PDF introuvable : " + e.getMessage(), e);
        }
    }

    // ─── Sécurité ─────────────────────────────────────────────────────────────

    public static void requireRhRole(Role role) {
        if (role != Role.RH) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Accès RH requis");
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private ContractEntity findOrThrow(Long id) {
        return contractRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "Contrat introuvable : " + id));
    }

    private void requireBrouillon(ContractEntity entity) {
        if (entity.getStatus() != ContractStatus.BROUILLON) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Cette action est réservée aux contrats au statut BROUILLON");
        }
    }

    private void validateCreate(ContractCreateDto dto) {
        if (dto.getType() == ContractType.CDD && dto.getEndDate() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "La date de fin est obligatoire pour un contrat CDD");
        }
        if (dto.getStartDate() != null && dto.getEndDate() != null
                && !dto.getEndDate().isAfter(dto.getStartDate())) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "La date de fin doit être postérieure à la date de début");
        }
    }

    /**
     * Résout le chemin absolu depuis une URL relative /uploads/contracts/...
     * en utilisant le même répertoire de base que FileStorageService.
     */
    private java.nio.file.Path resolveUploadPath(String relativeUrl) {
        // relativeUrl = "/uploads/contracts/{empId}/{contractId}/contrat.pdf"
        String relative = relativeUrl.startsWith("/") ? relativeUrl.substring(1) : relativeUrl;
        return java.nio.file.Path.of("uploads").toAbsolutePath().normalize().resolve(
                relative.replace("uploads/", ""));
    }
}
