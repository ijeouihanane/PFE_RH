package ma.pfe.rh.payroll.service;

import lombok.RequiredArgsConstructor;
import ma.pfe.rh.payroll.domain.IncomeTaxBracket;
import ma.pfe.rh.payroll.domain.PayrollProfile;
import ma.pfe.rh.payroll.domain.SeniorityRule;
import ma.pfe.rh.payroll.dto.PayslipLineDTO;
import ma.pfe.rh.payroll.dto.PayslipLineDTO.LineType;
import ma.pfe.rh.payroll.dto.SimulateRequest;
import ma.pfe.rh.payroll.dto.SimulateResponse;
import ma.pfe.rh.payroll.dto.VariableElementDTO;
import ma.pfe.rh.payroll.repo.IncomeTaxBracketRepository;
import ma.pfe.rh.payroll.repo.PayrollParameterRepository;
import ma.pfe.rh.payroll.repo.PayrollProfileRepository;
import ma.pfe.rh.payroll.repo.SeniorityRuleRepository;
import ma.pfe.rh.payroll.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class PayrollCalculationService {

    private static final RoundingMode RM = RoundingMode.HALF_UP;
    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final BigDecimal TWELVE = new BigDecimal("12");

    private static final Set<String> ALLOWED_VARIABLES = Set.of(
            "PRIME_TRANSPORT", "PRIME_PANIER", "BONUS", "INDEMNITE"
    );
    private static final Map<String, String> VARIABLE_LABELS = Map.of(
            "PRIME_TRANSPORT", "Prime transport",
            "PRIME_PANIER", "Prime panier",
            "BONUS", "Bonus",
            "INDEMNITE", "Indemnité"
    );

    private final PayrollProfileRepository profileRepository;
    private final PayrollParameterRepository parameterRepository;
    private final IncomeTaxBracketRepository taxBracketRepository;
    private final SeniorityRuleRepository seniorityRuleRepository;

    public SimulateResponse simulate(SimulateRequest request) {

        // 1. Charger le profil paie
        PayrollProfile profile = profileRepository.findByEmployeeId(request.getEmployeeId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "Profil paie introuvable pour l'employé #" + request.getEmployeeId()));

        if (!profile.isActive()) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Le profil paie de l'employé #" + request.getEmployeeId() + " est inactif.");
        }

        // 2. Charger les paramètres
        BigDecimal cnssRate   = getParam("CNSS_RATE");
        BigDecimal amoRate    = getParam("AMO_RATE");
        BigDecimal cnssCeiling = getParam("CNSS_CEILING");

        // 3. Charger les tranches IR et règles ancienneté
        List<IncomeTaxBracket> taxBrackets    = taxBracketRepository.findByActiveTrueOrderByMinAnnualIncomeAsc();
        List<SeniorityRule>    seniorityRules = seniorityRuleRepository.findByActiveTrueOrderByMinYearsAsc();

        // 4. Calculer
        BigDecimal baseSalary = profile.getBaseSalary();
        BigDecimal fixedBonus = profile.getFixedBonus() != null ? profile.getFixedBonus() : BigDecimal.ZERO;

        // Ancienneté calculée à la fin du mois de paie
        LocalDate endOfPayMonth = LocalDate.of(request.getAnnee(), request.getMois(), 1)
                .plusMonths(1).minusDays(1);
        long seniorityYears = request.getDateEmbauche() != null
                ? ChronoUnit.YEARS.between(request.getDateEmbauche(), endOfPayMonth)
                : 0;
        if (seniorityYears < 0) seniorityYears = 0;

        BigDecimal seniorityRate  = findSeniorityRate(seniorityRules, (int) seniorityYears);
        BigDecimal seniorityBonus = baseSalary.multiply(seniorityRate).divide(HUNDRED, 2, RM);

        // Variables RH
        BigDecimal totalVariables = BigDecimal.ZERO;
        List<VariableElementDTO> validVariables = new ArrayList<>();
        if (request.getVariables() != null) {
            for (VariableElementDTO v : request.getVariables()) {
                if (v.getCode() != null && ALLOWED_VARIABLES.contains(v.getCode())
                        && v.getAmount() != null && v.getAmount().compareTo(BigDecimal.ZERO) > 0) {
                    totalVariables = totalVariables.add(v.getAmount());
                    validVariables.add(v);
                }
            }
        }

        // Salaire brut
        BigDecimal grossSalary = baseSalary.add(fixedBonus).add(seniorityBonus).add(totalVariables);

        // CNSS
        BigDecimal cnssBase   = grossSalary.min(cnssCeiling);
        BigDecimal cnssAmount = cnssBase.multiply(cnssRate).divide(HUNDRED, 2, RM);

        // AMO
        BigDecimal amoAmount = grossSalary.multiply(amoRate).divide(HUNDRED, 2, RM);

        // Net imposable
        BigDecimal taxableNet = grossSalary.subtract(cnssAmount).subtract(amoAmount).setScale(2, RM);

        // IR
        BigDecimal annualIncome = taxableNet.multiply(TWELVE);
        BigDecimal irAnnual     = calculateIR(taxBrackets, annualIncome);
        BigDecimal irMonthly    = irAnnual.divide(TWELVE, 2, RM);
        irMonthly = irMonthly.max(BigDecimal.ZERO); // IR jamais négatif

        // Net à payer (avant retenue spécifique)
        BigDecimal netPay = grossSalary.subtract(cnssAmount).subtract(amoAmount).subtract(irMonthly).setScale(2, RM);

        // ---- Tâche 1 : Retenue spécifique ----
        // Appliquée APRÈS IR — diminue uniquement le net à payer.
        // Ne modifie pas : grossSalary, cnssAmount, amoAmount, taxableNet, irMonthly.
        BigDecimal retenueSpec = BigDecimal.ZERO;
        String     motifRetenue = null;

        if (request.getRetenueSpecifique() != null
                && request.getRetenueSpecifique().compareTo(BigDecimal.ZERO) > 0) {

            String motif = request.getMotifRetenue();
            if (motif == null || motif.isBlank()) {
                throw new ApiException(HttpStatus.BAD_REQUEST,
                        "Le motif est obligatoire quand une retenue spécifique est saisie.");
            }
            retenueSpec = request.getRetenueSpecifique().setScale(2, RM);
            motifRetenue = motif.trim();
            netPay = netPay.subtract(retenueSpec).setScale(2, RM);
        }
        // ---- Fin Tâche 1 ----

        // 5. Construire les lignes
        BigDecimal totalGains      = BigDecimal.ZERO;
        BigDecimal totalDeductions = BigDecimal.ZERO;
        List<PayslipLineDTO> lines = new ArrayList<>();

        // --- Gains ---
        lines.add(PayslipLineDTO.builder()
                .code("SALAIRE_BASE").label("Salaire de base").type(LineType.GAIN)
                .base(baseSalary).rate(null).amount(baseSalary).manual(false).build());
        totalGains = totalGains.add(baseSalary);

        if (fixedBonus.compareTo(BigDecimal.ZERO) > 0) {
            lines.add(PayslipLineDTO.builder()
                    .code("PRIME_FIXE").label("Prime fixe").type(LineType.GAIN)
                    .base(null).rate(null).amount(fixedBonus).manual(false).build());
            totalGains = totalGains.add(fixedBonus);
        }

        if (seniorityBonus.compareTo(BigDecimal.ZERO) > 0) {
            lines.add(PayslipLineDTO.builder()
                    .code("PRIME_ANCIENNETE").label("Prime ancienneté").type(LineType.GAIN)
                    .base(baseSalary).rate(seniorityRate).amount(seniorityBonus).manual(false).build());
            totalGains = totalGains.add(seniorityBonus);
        }

        for (VariableElementDTO v : validVariables) {
            String label = VARIABLE_LABELS.getOrDefault(v.getCode(), v.getCode());
            lines.add(PayslipLineDTO.builder()
                    .code(v.getCode()).label(label).type(LineType.GAIN)
                    .base(null).rate(null).amount(v.getAmount()).manual(true).build());
            totalGains = totalGains.add(v.getAmount());
        }

        // --- Retenues obligatoires ---
        lines.add(PayslipLineDTO.builder()
                .code("CNSS").label("CNSS").type(LineType.DEDUCTION)
                .base(cnssBase).rate(cnssRate).amount(cnssAmount).manual(false).build());
        totalDeductions = totalDeductions.add(cnssAmount);

        lines.add(PayslipLineDTO.builder()
                .code("AMO").label("AMO").type(LineType.DEDUCTION)
                .base(grossSalary).rate(amoRate).amount(amoAmount).manual(false).build());
        totalDeductions = totalDeductions.add(amoAmount);

        lines.add(PayslipLineDTO.builder()
                .code("IR").label("IR").type(LineType.DEDUCTION)
                .base(taxableNet).rate(null).amount(irMonthly).manual(false).build());
        totalDeductions = totalDeductions.add(irMonthly);

        // --- Retenue spécifique (Tâche 1) ---
        if (retenueSpec.compareTo(BigDecimal.ZERO) > 0) {
            String lineLabel = "Retenue spécifique - " + motifRetenue;
            lines.add(PayslipLineDTO.builder()
                    .code("RETENUE_SPECIFIQUE")
                    .label(lineLabel)
                    .type(LineType.DEDUCTION)
                    .base(null).rate(null).amount(retenueSpec).manual(true).build());
            totalDeductions = totalDeductions.add(retenueSpec);
        }

        return SimulateResponse.builder()
                .lines(lines)
                .grossSalary(grossSalary)
                .totalGains(totalGains)
                .totalDeductions(totalDeductions)
                .cnssAmount(cnssAmount)
                .amoAmount(amoAmount)
                .taxableNet(taxableNet)
                .irAmount(irMonthly)
                .netPay(netPay)
                .retenueSpecifique(retenueSpec)
                .build();
    }

    // --- helpers ---

    private BigDecimal getParam(String code) {
        return parameterRepository.findByCodeAndActiveTrue(code)
                .orElseThrow(() -> new ApiException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "Paramètre paie introuvable : " + code))
                .getValue();
    }

    BigDecimal findSeniorityRate(List<SeniorityRule> rules, int years) {
        for (SeniorityRule r : rules) {
            boolean aboveMin = years >= r.getMinYears();
            boolean belowMax = r.getMaxYears() == null || years < r.getMaxYears();
            if (aboveMin && belowMax) {
                return r.getRate();
            }
        }
        return BigDecimal.ZERO;
    }

    BigDecimal calculateIR(List<IncomeTaxBracket> brackets, BigDecimal annualIncome) {
        for (int i = brackets.size() - 1; i >= 0; i--) {
            IncomeTaxBracket b = brackets.get(i);
            if (annualIncome.compareTo(b.getMinAnnualIncome()) >= 0) {
                BigDecimal irBrut = annualIncome.multiply(b.getRate()).divide(HUNDRED, 2, RM);
                return irBrut.subtract(b.getDeduction()).max(BigDecimal.ZERO);
            }
        }
        return BigDecimal.ZERO;
    }
}
