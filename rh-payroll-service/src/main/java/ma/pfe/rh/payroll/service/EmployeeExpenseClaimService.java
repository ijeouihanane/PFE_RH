package ma.pfe.rh.payroll.service;

import lombok.RequiredArgsConstructor;
import ma.pfe.rh.payroll.domain.EmployeeExpenseClaim;
import ma.pfe.rh.payroll.domain.EmployeeExpenseClaimStatus;
import ma.pfe.rh.payroll.dto.EmployeeExpenseClaimRequest;
import ma.pfe.rh.payroll.dto.EmployeeExpenseClaimResponse;
import ma.pfe.rh.payroll.dto.EmployeeExpenseClaimSummaryResponse;
import ma.pfe.rh.payroll.dto.ReimburseExpenseClaimRequest;
import ma.pfe.rh.payroll.dto.RejectExpenseClaimRequest;
import ma.pfe.rh.payroll.repo.EmployeeExpenseClaimRepository;
import ma.pfe.rh.payroll.storage.EmployeeExpenseClaimFileStorage;
import ma.pfe.rh.payroll.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class EmployeeExpenseClaimService {

    private final EmployeeExpenseClaimRepository repository;
    private final EmployeeExpenseClaimFileStorage fileStorage;

    @Transactional(readOnly = true)
    public List<EmployeeExpenseClaimResponse> myClaims(Long employeeId) {
        return repository.findAllByEmployeeIdOrderBySubmittedAtDescIdDesc(employeeId).stream()
            .map(this::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<EmployeeExpenseClaimResponse> rhClaims() {
        return repository.findAllByOrderBySubmittedAtDescIdDesc().stream()
            .map(this::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public EmployeeExpenseClaimResponse get(Long id, Long requesterId, boolean rh) {
        EmployeeExpenseClaim claim = find(id);
        if (!rh && !claim.getEmployeeId().equals(requesterId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Acces interdit");
        }
        return toResponse(claim);
    }

    @Transactional
    public EmployeeExpenseClaimResponse create(Long employeeId, EmployeeExpenseClaimRequest request, MultipartFile justificatif) {
        validateClaimRequest(request);
        if (justificatif == null || justificatif.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Le justificatif est obligatoire");
        }

        Instant now = Instant.now();
        EmployeeExpenseClaim claim = EmployeeExpenseClaim.builder()
            .employeeId(employeeId)
            .employeeFirstName(normalize(request.employeeFirstName()))
            .employeeLastName(normalize(request.employeeLastName()))
            .motif(request.motif().trim())
            .categorie(request.categorie())
            .montant(request.montant())
            .dateHeure(request.dateHeure())
            .note(normalize(request.note()))
            .status(EmployeeExpenseClaimStatus.SOUMIS)
            .submittedAt(now)
            .createdAt(now)
            .build();
        applyJustificatif(claim, justificatif);
        return toResponse(repository.save(claim));
    }

    @Transactional
    public EmployeeExpenseClaimResponse update(Long id, Long employeeId, EmployeeExpenseClaimRequest request, MultipartFile justificatif) {
        validateClaimRequest(request);
        EmployeeExpenseClaim claim = findOwnedSubmitted(id, employeeId);
        claim.setMotif(request.motif().trim());
        claim.setCategorie(request.categorie());
        claim.setMontant(request.montant());
        claim.setDateHeure(request.dateHeure());
        claim.setNote(normalize(request.note()));
        claim.setEmployeeFirstName(normalize(request.employeeFirstName()));
        claim.setEmployeeLastName(normalize(request.employeeLastName()));
        claim.setUpdatedAt(Instant.now());
        if (justificatif != null && !justificatif.isEmpty()) {
            applyJustificatif(claim, justificatif);
        }
        return toResponse(repository.save(claim));
    }

    @Transactional
    public void delete(Long id, Long employeeId) {
        EmployeeExpenseClaim claim = findOwnedSubmitted(id, employeeId);
        repository.delete(claim);
    }

    @Transactional
    public EmployeeExpenseClaimResponse approve(Long id, Long rhUserId) {
        EmployeeExpenseClaim claim = find(id);
        if (claim.getStatus() != EmployeeExpenseClaimStatus.SOUMIS) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Seules les demandes soumises peuvent etre approuvees");
        }
        claim.setStatus(EmployeeExpenseClaimStatus.APPROUVE);
        claim.setReviewedAt(Instant.now());
        claim.setReviewedBy(rhUserId);
        claim.setRefusalReason(null);
        claim.setUpdatedAt(Instant.now());
        return toResponse(repository.save(claim));
    }

    @Transactional
    public EmployeeExpenseClaimResponse reject(Long id, Long rhUserId, RejectExpenseClaimRequest request) {
        EmployeeExpenseClaim claim = find(id);
        if (claim.getStatus() != EmployeeExpenseClaimStatus.SOUMIS) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Seules les demandes soumises peuvent etre refusees");
        }
        if (request == null || request.reason() == null || request.reason().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Le motif de refus est obligatoire");
        }
        claim.setStatus(EmployeeExpenseClaimStatus.REFUSE);
        claim.setReviewedAt(Instant.now());
        claim.setReviewedBy(rhUserId);
        claim.setRefusalReason(request.reason().trim());
        claim.setUpdatedAt(Instant.now());
        return toResponse(repository.save(claim));
    }

    @Transactional
    public EmployeeExpenseClaimResponse reimburse(Long id, ReimburseExpenseClaimRequest request, MultipartFile proof) {
        EmployeeExpenseClaim claim = find(id);
        if (claim.getStatus() != EmployeeExpenseClaimStatus.APPROUVE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Seules les demandes approuvees peuvent etre remboursees");
        }
        if (request == null || request.reimbursementMode() == null || request.reimbursedAt() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Mode et date de remboursement obligatoires");
        }
        claim.setStatus(EmployeeExpenseClaimStatus.REMBOURSE);
        claim.setReimbursementMode(request.reimbursementMode());
        claim.setReimbursedAt(request.reimbursedAt());
        claim.setReimbursementNote(normalize(request.reimbursementNote()));
        claim.setUpdatedAt(Instant.now());
        applyReimbursementProof(claim, proof);
        return toResponse(repository.save(claim));
    }

    @Transactional(readOnly = true)
    public EmployeeExpenseClaimSummaryResponse mySummary(Long employeeId) {
        return summary(repository.findAllByEmployeeIdOrderBySubmittedAtDescIdDesc(employeeId));
    }

    @Transactional(readOnly = true)
    public EmployeeExpenseClaimSummaryResponse rhSummary() {
        return summary(repository.findAll());
    }

    private EmployeeExpenseClaimSummaryResponse summary(List<EmployeeExpenseClaim> claims) {
        BigDecimal totalSubmitted = claims.stream()
            .map(EmployeeExpenseClaim::getMontant)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal pendingAmount = amountByStatus(claims, EmployeeExpenseClaimStatus.SOUMIS);
        BigDecimal approvedAmount = amountByStatus(claims, EmployeeExpenseClaimStatus.APPROUVE);
        BigDecimal reimbursedAmount = amountByStatus(claims, EmployeeExpenseClaimStatus.REMBOURSE);
        long pendingCount = claims.stream().filter(c -> c.getStatus() == EmployeeExpenseClaimStatus.SOUMIS).count();
        return new EmployeeExpenseClaimSummaryResponse(
            totalSubmitted,
            pendingAmount,
            approvedAmount,
            reimbursedAmount,
            pendingCount,
            claims.size()
        );
    }

    private BigDecimal amountByStatus(List<EmployeeExpenseClaim> claims, EmployeeExpenseClaimStatus status) {
        return claims.stream()
            .filter(c -> c.getStatus() == status)
            .map(EmployeeExpenseClaim::getMontant)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private EmployeeExpenseClaim findOwnedSubmitted(Long id, Long employeeId) {
        EmployeeExpenseClaim claim = find(id);
        if (!claim.getEmployeeId().equals(employeeId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Acces interdit");
        }
        if (claim.getStatus() != EmployeeExpenseClaimStatus.SOUMIS) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La demande ne peut plus etre modifiee");
        }
        return claim;
    }

    private EmployeeExpenseClaim find(Long id) {
        return repository.findById(id)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Demande introuvable"));
    }

    private void validateClaimRequest(EmployeeExpenseClaimRequest request) {
        if (request == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Donnees manquantes");
        }
        if (request.motif() == null || request.motif().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Le motif est obligatoire");
        }
        if (request.categorie() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La categorie est obligatoire");
        }
        if (request.montant() == null || request.montant().compareTo(BigDecimal.ZERO) <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Le montant doit etre positif");
        }
        if (request.dateHeure() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La date de depense est obligatoire");
        }
    }

    private void applyJustificatif(EmployeeExpenseClaim claim, MultipartFile justificatif) {
        try {
            claim.setJustificatifUrl(fileStorage.store(claim.getEmployeeId(), justificatif));
            claim.setJustificatifOriginalName(justificatif.getOriginalFilename());
        } catch (IOException | IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    private void applyReimbursementProof(EmployeeExpenseClaim claim, MultipartFile proof) {
        if (proof == null || proof.isEmpty()) {
            return;
        }
        try {
            claim.setReimbursementProofUrl(fileStorage.storeReimbursementProof(claim.getId(), proof));
            claim.setReimbursementProofOriginalName(proof.getOriginalFilename());
        } catch (IOException | IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    private String normalize(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private EmployeeExpenseClaimResponse toResponse(EmployeeExpenseClaim claim) {
        String first = claim.getEmployeeFirstName() != null ? claim.getEmployeeFirstName() : "";
        String last = claim.getEmployeeLastName() != null ? claim.getEmployeeLastName() : "";
        String label = (first + " " + last).trim();
        if (label.isBlank()) {
            label = "Salarie #" + claim.getEmployeeId();
        }
        String initials = ((first.isBlank() ? "" : first.substring(0, 1)) + (last.isBlank() ? "" : last.substring(0, 1))).toUpperCase();
        if (initials.isBlank()) {
            initials = "SL";
        }
        return new EmployeeExpenseClaimResponse(
            claim.getId(),
            claim.getEmployeeId(),
            claim.getEmployeeFirstName(),
            claim.getEmployeeLastName(),
            label,
            initials,
            claim.getMotif(),
            claim.getCategorie(),
            claim.getMontant(),
            claim.getDateHeure(),
            claim.getNote(),
            claim.getJustificatifUrl(),
            claim.getJustificatifOriginalName(),
            claim.getStatus(),
            claim.getRefusalReason(),
            claim.getSubmittedAt(),
            claim.getReviewedAt(),
            claim.getReviewedBy(),
            claim.getReimbursementMode(),
            claim.getReimbursedAt(),
            claim.getReimbursementNote(),
            claim.getReimbursementProofUrl(),
            claim.getReimbursementProofOriginalName(),
            claim.getCreatedAt(),
            claim.getUpdatedAt()
        );
    }
}
