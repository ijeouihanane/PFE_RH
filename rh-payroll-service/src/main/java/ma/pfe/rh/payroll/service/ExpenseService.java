package ma.pfe.rh.payroll.service;

import lombok.RequiredArgsConstructor;
import ma.pfe.rh.payroll.domain.Expense;
import ma.pfe.rh.payroll.dto.ExpenseRequest;
import ma.pfe.rh.payroll.dto.ExpenseResponse;
import ma.pfe.rh.payroll.dto.ExpenseSummaryResponse;
import ma.pfe.rh.payroll.repo.ExpenseRepository;
import ma.pfe.rh.payroll.storage.ExpenseFileStorage;
import ma.pfe.rh.payroll.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final ExpenseFileStorage fileStorage;

    @Transactional(readOnly = true)
    public List<ExpenseResponse> list() {
        return expenseRepository.findAllByOrderByDateHeureDescIdDesc().stream()
            .map(this::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public ExpenseResponse get(Long id) {
        return toResponse(find(id));
    }

    @Transactional
    public ExpenseResponse create(ExpenseRequest request, MultipartFile justificatif) {
        validate(request);
        Expense expense = Expense.builder()
            .motif(request.motif().trim())
            .montant(request.montant())
            .dateHeure(request.dateHeure())
            .note(normalizeNote(request.note()))
            .createdAt(Instant.now())
            .build();
        applyJustificatif(expense, justificatif);
        return toResponse(expenseRepository.save(expense));
    }

    @Transactional
    public ExpenseResponse update(Long id, ExpenseRequest request, MultipartFile justificatif) {
        validate(request);
        Expense expense = find(id);
        expense.setMotif(request.motif().trim());
        expense.setMontant(request.montant());
        expense.setDateHeure(request.dateHeure());
        expense.setNote(normalizeNote(request.note()));
        expense.setUpdatedAt(Instant.now());

        if (request.removeJustificatif()) {
            expense.setJustificatifUrl(null);
            expense.setJustificatifOriginalName(null);
        }
        applyJustificatif(expense, justificatif);
        return toResponse(expenseRepository.save(expense));
    }

    @Transactional
    public void delete(Long id) {
        Expense expense = find(id);
        expenseRepository.delete(expense);
    }

    @Transactional(readOnly = true)
    public ExpenseSummaryResponse summary() {
        List<Expense> expenses = expenseRepository.findAll();
        LocalDate today = LocalDate.now();
        LocalDateTime start = today.withDayOfMonth(1).atStartOfDay();
        LocalDateTime end = start.plusMonths(1);

        BigDecimal total = expenses.stream()
            .map(Expense::getMontant)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal monthTotal = expenses.stream()
            .filter(e -> !e.getDateHeure().isBefore(start) && e.getDateHeure().isBefore(end))
            .map(Expense::getMontant)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        Expense last = expenseRepository.findAllByOrderByDateHeureDescIdDesc().stream().findFirst().orElse(null);
        return new ExpenseSummaryResponse(
            total,
            monthTotal,
            expenses.size(),
            last != null ? last.getMontant() : BigDecimal.ZERO,
            last != null ? last.getMotif() : null
        );
    }

    private Expense find(Long id) {
        return expenseRepository.findById(id)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Depense introuvable"));
    }

    private void validate(ExpenseRequest request) {
        if (request == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Donnees de depense manquantes");
        }
        if (request.motif() == null || request.motif().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Le motif est obligatoire");
        }
        if (request.montant() == null || request.montant().compareTo(BigDecimal.ZERO) <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Le montant doit etre positif");
        }
        if (request.dateHeure() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La date et heure sont obligatoires");
        }
    }

    private void applyJustificatif(Expense expense, MultipartFile justificatif) {
        if (justificatif == null || justificatif.isEmpty()) {
            return;
        }
        try {
            expense.setJustificatifUrl(fileStorage.store(justificatif));
            expense.setJustificatifOriginalName(justificatif.getOriginalFilename());
        } catch (IOException | IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    private String normalizeNote(String note) {
        if (note == null || note.isBlank()) {
            return null;
        }
        return note.trim();
    }

    private ExpenseResponse toResponse(Expense expense) {
        return new ExpenseResponse(
            expense.getId(),
            expense.getMotif(),
            expense.getMontant(),
            expense.getDateHeure(),
            expense.getNote(),
            expense.getJustificatifUrl(),
            expense.getJustificatifOriginalName(),
            expense.getCreatedAt(),
            expense.getUpdatedAt()
        );
    }
}
