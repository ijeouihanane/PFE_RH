package ma.pfe.rh.payroll.service;

import lombok.RequiredArgsConstructor;
import ma.pfe.rh.payroll.domain.EmployeeExpenseClaim;
import ma.pfe.rh.payroll.domain.EmployeeExpenseClaimStatus;
import ma.pfe.rh.payroll.domain.Expense;
import ma.pfe.rh.payroll.domain.Payslip;
import ma.pfe.rh.payroll.domain.PayslipStatus;
import ma.pfe.rh.payroll.dto.PayrollDashboardMonthResponse;
import ma.pfe.rh.payroll.dto.PayrollDashboardSummaryResponse;
import ma.pfe.rh.payroll.repo.EmployeeExpenseClaimRepository;
import ma.pfe.rh.payroll.repo.ExpenseRepository;
import ma.pfe.rh.payroll.repo.PayslipRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class PayrollDashboardService {

    private static final Locale FR = Locale.FRENCH;

    private final PayslipRepository payslipRepository;
    private final ExpenseRepository expenseRepository;
    private final EmployeeExpenseClaimRepository claimRepository;

    @Transactional(readOnly = true)
    public PayrollDashboardSummaryResponse rhSummary(int month, int year) {
        List<Payslip> payslips = payslipRepository.findAll();
        List<Expense> expenses = expenseRepository.findAll();
        List<EmployeeExpenseClaim> claims = claimRepository.findAll();

        MonthTotals current = totalsFor(month, year, payslips, expenses, claims);
        BigDecimal pendingReimbursement = claims.stream()
            .filter(c -> c.getStatus() == EmployeeExpenseClaimStatus.APPROUVE)
            .map(c -> safe(c.getMontant()))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        long pendingReimbursementCount = claims.stream()
            .filter(c -> c.getStatus() == EmployeeExpenseClaimStatus.APPROUVE)
            .count();

        List<PayrollDashboardMonthResponse> monthly = new ArrayList<>();
        LocalDate cursor = LocalDate.of(year, month, 1).minusMonths(5);
        for (int i = 0; i < 6; i++) {
            MonthTotals totals = totalsFor(cursor.getMonthValue(), cursor.getYear(), payslips, expenses, claims);
            monthly.add(new PayrollDashboardMonthResponse(
                monthLabel(cursor),
                cursor.getMonthValue(),
                cursor.getYear(),
                totals.netPayroll(),
                totals.rhExpenses(),
                totals.reimbursedClaims(),
                totals.socialCharges(),
                totals.totalOutflow()
            ));
            cursor = cursor.plusMonths(1);
        }

        return new PayrollDashboardSummaryResponse(
            month,
            year,
            current.netPayroll(),
            current.grossPayroll(),
            current.socialCharges(),
            current.rhExpenses(),
            current.reimbursedClaims(),
            pendingReimbursement,
            current.totalOutflow(),
            current.generatedPayslipCount(),
            pendingReimbursementCount,
            monthly
        );
    }

    private MonthTotals totalsFor(
        int month,
        int year,
        List<Payslip> payslips,
        List<Expense> expenses,
        List<EmployeeExpenseClaim> claims
    ) {
        BigDecimal netPayroll = payslips.stream()
            .filter(p -> p.getMois() == month && p.getAnnee() == year)
            .filter(this::isGenerated)
            .map(p -> safe(p.getNetPay()))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal grossPayroll = payslips.stream()
            .filter(p -> p.getMois() == month && p.getAnnee() == year)
            .filter(this::isGenerated)
            .map(p -> safe(p.getGrossSalary()))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal socialCharges = payslips.stream()
            .filter(p -> p.getMois() == month && p.getAnnee() == year)
            .filter(this::isGenerated)
            .map(p -> safe(p.getCnssAmount()).add(safe(p.getAmoAmount())).add(safe(p.getIrAmount())))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        long generatedPayslipCount = payslips.stream()
            .filter(p -> p.getMois() == month && p.getAnnee() == year)
            .filter(this::isGenerated)
            .count();

        LocalDateTime start = LocalDate.of(year, month, 1).atStartOfDay();
        LocalDateTime end = start.plusMonths(1);
        BigDecimal rhExpenses = expenses.stream()
            .filter(e -> !e.getDateHeure().isBefore(start) && e.getDateHeure().isBefore(end))
            .map(e -> safe(e.getMontant()))
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal reimbursedClaims = claims.stream()
            .filter(c -> c.getStatus() == EmployeeExpenseClaimStatus.REMBOURSE)
            .filter(c -> c.getReimbursedAt() != null)
            .filter(c -> c.getReimbursedAt().getMonthValue() == month && c.getReimbursedAt().getYear() == year)
            .map(c -> safe(c.getMontant()))
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new MonthTotals(
            netPayroll,
            grossPayroll,
            socialCharges,
            rhExpenses,
            reimbursedClaims,
            netPayroll.add(rhExpenses).add(reimbursedClaims),
            generatedPayslipCount
        );
    }

    private boolean isGenerated(Payslip payslip) {
        return payslip.getStatus() == PayslipStatus.VALIDATED || payslip.getStatus() == PayslipStatus.SENT;
    }

    private BigDecimal safe(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private String monthLabel(LocalDate date) {
        String label = date.getMonth().getDisplayName(TextStyle.SHORT, FR).replace(".", "");
        return label.substring(0, 1).toUpperCase(FR) + label.substring(1);
    }

    private record MonthTotals(
        BigDecimal netPayroll,
        BigDecimal grossPayroll,
        BigDecimal socialCharges,
        BigDecimal rhExpenses,
        BigDecimal reimbursedClaims,
        BigDecimal totalOutflow,
        long generatedPayslipCount
    ) {
    }
}
