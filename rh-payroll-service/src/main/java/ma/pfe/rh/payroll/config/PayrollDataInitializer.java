package ma.pfe.rh.payroll.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import ma.pfe.rh.payroll.domain.IncomeTaxBracket;
import ma.pfe.rh.payroll.domain.PayrollParameter;
import ma.pfe.rh.payroll.domain.SeniorityRule;
import ma.pfe.rh.payroll.repo.IncomeTaxBracketRepository;
import ma.pfe.rh.payroll.repo.PayrollParameterRepository;
import ma.pfe.rh.payroll.repo.SeniorityRuleRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;

@Slf4j
@Component
@RequiredArgsConstructor
public class PayrollDataInitializer implements ApplicationRunner {

    private final PayrollParameterRepository parameterRepository;
    private final IncomeTaxBracketRepository taxBracketRepository;
    private final SeniorityRuleRepository seniorityRuleRepository;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        initParameters();
        initTaxBrackets();
        initSeniorityRules();
    }

    private void initParameters() {
        if (parameterRepository.findByActiveTrue().isEmpty()) {
            log.info("Initialisation des paramètres de paie par défaut...");
            parameterRepository.save(PayrollParameter.builder()
                    .code("CNSS_RATE").label("Taux CNSS salarié (%)").value(new BigDecimal("4.48"))
                    .effectiveFrom(LocalDate.of(2026, 1, 1)).active(true).build());
            parameterRepository.save(PayrollParameter.builder()
                    .code("AMO_RATE").label("Taux AMO salarié (%)").value(new BigDecimal("2.26"))
                    .effectiveFrom(LocalDate.of(2026, 1, 1)).active(true).build());
            parameterRepository.save(PayrollParameter.builder()
                    .code("CNSS_CEILING").label("Plafond CNSS (DH)").value(new BigDecimal("6000"))
                    .effectiveFrom(LocalDate.of(2026, 1, 1)).active(true).build());
        }
    }

    private void initTaxBrackets() {
        if (taxBracketRepository.findByActiveTrueOrderByMinAnnualIncomeAsc().isEmpty()) {
            log.info("Initialisation des tranches IR 2026...");
            LocalDate from = LocalDate.of(2026, 1, 1);
            taxBracketRepository.save(IncomeTaxBracket.builder()
                    .minAnnualIncome(BigDecimal.ZERO).maxAnnualIncome(new BigDecimal("40000"))
                    .rate(BigDecimal.ZERO).deduction(BigDecimal.ZERO)
                    .active(true).effectiveFrom(from).build());
            taxBracketRepository.save(IncomeTaxBracket.builder()
                    .minAnnualIncome(new BigDecimal("40001")).maxAnnualIncome(new BigDecimal("60000"))
                    .rate(new BigDecimal("10")).deduction(new BigDecimal("4000"))
                    .active(true).effectiveFrom(from).build());
            taxBracketRepository.save(IncomeTaxBracket.builder()
                    .minAnnualIncome(new BigDecimal("60001")).maxAnnualIncome(new BigDecimal("80000"))
                    .rate(new BigDecimal("20")).deduction(new BigDecimal("10000"))
                    .active(true).effectiveFrom(from).build());
            taxBracketRepository.save(IncomeTaxBracket.builder()
                    .minAnnualIncome(new BigDecimal("80001")).maxAnnualIncome(new BigDecimal("100000"))
                    .rate(new BigDecimal("30")).deduction(new BigDecimal("18000"))
                    .active(true).effectiveFrom(from).build());
            taxBracketRepository.save(IncomeTaxBracket.builder()
                    .minAnnualIncome(new BigDecimal("100001")).maxAnnualIncome(new BigDecimal("180000"))
                    .rate(new BigDecimal("34")).deduction(new BigDecimal("22000"))
                    .active(true).effectiveFrom(from).build());
            taxBracketRepository.save(IncomeTaxBracket.builder()
                    .minAnnualIncome(new BigDecimal("180001")).maxAnnualIncome(null)
                    .rate(new BigDecimal("37")).deduction(new BigDecimal("27400"))
                    .active(true).effectiveFrom(from).build());
        }
    }

    private void initSeniorityRules() {
        if (seniorityRuleRepository.findByActiveTrueOrderByMinYearsAsc().isEmpty()) {
            log.info("Initialisation des règles d'ancienneté...");
            seniorityRuleRepository.save(SeniorityRule.builder()
                    .minYears(0).maxYears(2).rate(BigDecimal.ZERO).active(true).build());
            seniorityRuleRepository.save(SeniorityRule.builder()
                    .minYears(2).maxYears(5).rate(new BigDecimal("5")).active(true).build());
            seniorityRuleRepository.save(SeniorityRule.builder()
                    .minYears(5).maxYears(12).rate(new BigDecimal("10")).active(true).build());
            seniorityRuleRepository.save(SeniorityRule.builder()
                    .minYears(12).maxYears(20).rate(new BigDecimal("15")).active(true).build());
            seniorityRuleRepository.save(SeniorityRule.builder()
                    .minYears(20).maxYears(25).rate(new BigDecimal("20")).active(true).build());
            seniorityRuleRepository.save(SeniorityRule.builder()
                    .minYears(25).maxYears(null).rate(new BigDecimal("25")).active(true).build());
        }
    }
}
