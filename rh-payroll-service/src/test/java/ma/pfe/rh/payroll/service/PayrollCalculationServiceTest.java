package ma.pfe.rh.payroll.service;

import ma.pfe.rh.payroll.domain.IncomeTaxBracket;
import ma.pfe.rh.payroll.domain.PayrollParameter;
import ma.pfe.rh.payroll.domain.PayrollProfile;
import ma.pfe.rh.payroll.domain.SeniorityRule;
import ma.pfe.rh.payroll.dto.PayslipLineDTO;
import ma.pfe.rh.payroll.dto.SimulateRequest;
import ma.pfe.rh.payroll.dto.SimulateResponse;
import ma.pfe.rh.payroll.dto.VariableElementDTO;
import ma.pfe.rh.payroll.repo.IncomeTaxBracketRepository;
import ma.pfe.rh.payroll.repo.PayrollParameterRepository;
import ma.pfe.rh.payroll.repo.PayrollProfileRepository;
import ma.pfe.rh.payroll.repo.SeniorityRuleRepository;
import ma.pfe.rh.payroll.web.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = org.mockito.quality.Strictness.LENIENT)
class PayrollCalculationServiceTest {

    @Mock PayrollProfileRepository profileRepository;
    @Mock PayrollParameterRepository parameterRepository;
    @Mock IncomeTaxBracketRepository taxBracketRepository;
    @Mock SeniorityRuleRepository seniorityRuleRepository;

    @InjectMocks PayrollCalculationService service;

    private PayrollProfile profile;

    @BeforeEach
    void setup() {
        profile = PayrollProfile.builder()
                .employeeId(1L)
                .baseSalary(new BigDecimal("8000"))
                .fixedBonus(new BigDecimal("500"))
                .active(true)
                .build();

        when(profileRepository.findByEmployeeId(1L)).thenReturn(Optional.of(profile));
        when(parameterRepository.findByCodeAndActiveTrue("CNSS_RATE"))
                .thenReturn(Optional.of(param("CNSS_RATE", "4.48")));
        when(parameterRepository.findByCodeAndActiveTrue("AMO_RATE"))
                .thenReturn(Optional.of(param("AMO_RATE", "2.26")));
        when(parameterRepository.findByCodeAndActiveTrue("CNSS_CEILING"))
                .thenReturn(Optional.of(param("CNSS_CEILING", "6000")));
        when(taxBracketRepository.findByActiveTrueOrderByMinAnnualIncomeAsc())
                .thenReturn(defaultBrackets());
        when(seniorityRuleRepository.findByActiveTrueOrderByMinYearsAsc())
                .thenReturn(defaultSeniorityRules());
    }

    // =====================================================================
    // Tests existants (inchangés — régression)
    // =====================================================================

    @Test
    void cnss_below_ceiling() {
        profile.setBaseSalary(new BigDecimal("5000"));
        profile.setFixedBonus(BigDecimal.ZERO);
        SimulateResponse r = simulate(1L, LocalDate.of(2024, 1, 1), 5, 2026);
        // brut = 5000 + 0 + 250 (5% seniority, 2 years) = 5250
        // CNSS base = min(5250, 6000) = 5250
        // CNSS = 5250 * 4.48 / 100 = 235.20
        assertEquals(0, r.getCnssAmount().compareTo(new BigDecimal("235.20")),
                "CNSS sous plafond : base = brut");
    }

    @Test
    void cnss_with_ceiling() {
        profile.setBaseSalary(new BigDecimal("10000"));
        profile.setFixedBonus(BigDecimal.ZERO);
        SimulateResponse r = simulate(1L, null, 5, 2026);
        // brut = 10000, ancienneté = 0
        // CNSS base = min(10000, 6000) = 6000
        // CNSS = 6000 * 4.48 / 100 = 268.80
        assertEquals(0, r.getCnssAmount().compareTo(new BigDecimal("268.80")),
                "CNSS avec plafond 6000");
    }

    @Test
    void amo_on_full_gross() {
        profile.setBaseSalary(new BigDecimal("10000"));
        profile.setFixedBonus(new BigDecimal("1000"));
        SimulateResponse r = simulate(1L, null, 5, 2026);
        // brut = 10000 + 1000 = 11000, ancienneté = 0
        // AMO = 11000 * 2.26 / 100 = 248.60
        assertEquals(0, r.getAmoAmount().compareTo(new BigDecimal("248.60")),
                "AMO sur brut complet");
    }

    @Test
    void seniority_0_percent() {
        // Embauche il y a 1 an => tranche [0, 2) => 0%
        SimulateResponse r = simulate(1L, LocalDate.of(2025, 6, 1), 5, 2026);
        // base=8000, fixed=500, ancienneté=0 => brut=8500
        assertEquals(0, r.getGrossSalary().compareTo(new BigDecimal("8500.00")));
    }

    @Test
    void seniority_5_percent() {
        // Embauche il y a 3 ans => tranche [2, 5) => 5%
        SimulateResponse r = simulate(1L, LocalDate.of(2023, 1, 1), 5, 2026);
        // base=8000, fixed=500, ancienneté=8000*5%=400 => brut=8900
        assertEquals(0, r.getGrossSalary().compareTo(new BigDecimal("8900.00")));
    }

    @Test
    void seniority_10_percent() {
        // Embauche il y a 7 ans => tranche [5, 12) => 10%
        SimulateResponse r = simulate(1L, LocalDate.of(2019, 1, 1), 5, 2026);
        // base=8000, fixed=500, ancienneté=8000*10%=800 => brut=9300
        assertEquals(0, r.getGrossSalary().compareTo(new BigDecimal("9300.00")));
    }

    @Test
    void seniority_15_percent() {
        // 12 ans => tranche [12, 20) => 15%
        SimulateResponse r = simulate(1L, LocalDate.of(2014, 5, 1), 5, 2026);
        // base=8000, fixed=500, ancienneté=8000*15%=1200 => brut=9700
        assertEquals(0, r.getGrossSalary().compareTo(new BigDecimal("9700.00")));
    }

    @Test
    void seniority_20_percent() {
        // 20 ans => tranche [20, 25) => 20%
        SimulateResponse r = simulate(1L, LocalDate.of(2006, 5, 1), 5, 2026);
        // base=8000, fixed=500, ancienneté=8000*20%=1600 => brut=10100
        assertEquals(0, r.getGrossSalary().compareTo(new BigDecimal("10100.00")));
    }

    @Test
    void seniority_25_percent() {
        // 25 ans => tranche [25, null) => 25%
        SimulateResponse r = simulate(1L, LocalDate.of(2001, 5, 1), 5, 2026);
        // base=8000, fixed=500, ancienneté=8000*25%=2000 => brut=10500
        assertEquals(0, r.getGrossSalary().compareTo(new BigDecimal("10500.00")));
    }

    @Test
    void ir_tranche_0_percent() {
        // Very low salary => exempt
        profile.setBaseSalary(new BigDecimal("2500"));
        profile.setFixedBonus(BigDecimal.ZERO);
        SimulateResponse r = simulate(1L, null, 5, 2026);
        // brut = 2500, CNSS = 2500*4.48/100=112, AMO = 2500*2.26/100=56.50
        // net imposable = 2500-112-56.50=2331.50
        // annuel = 27978 => tranche [0, 40000] => 0%
        assertEquals(0, r.getIrAmount().compareTo(BigDecimal.ZERO),
                "IR tranche 0%");
    }

    @Test
    void ir_tranche_20_percent() {
        profile.setBaseSalary(new BigDecimal("8000"));
        profile.setFixedBonus(new BigDecimal("500"));
        SimulateResponse r = simulate(1L, null, 5, 2026);
        // brut = 8500, CNSS base=6000, CNSS=268.80, AMO=8500*2.26/100=192.10
        // net imposable = 8500-268.80-192.10=8039.10
        // annuel = 96469.20 => tranche [80001, 100000] => 30%, deduction 18000
        // IR annuel = (96469.20 * 30 / 100) - 18000 = 28940.76 - 18000 = 10940.76
        // IR mensuel = 10940.76 / 12 = 911.73
        assertEquals(0, r.getIrAmount().compareTo(new BigDecimal("911.73")),
                "IR tranche 30%");
    }

    @Test
    void ir_never_negative() {
        profile.setBaseSalary(new BigDecimal("3000"));
        profile.setFixedBonus(BigDecimal.ZERO);
        SimulateResponse r = simulate(1L, null, 5, 2026);
        assertTrue(r.getIrAmount().compareTo(BigDecimal.ZERO) >= 0, "IR >= 0");
    }

    @Test
    void net_pay_calculation() {
        profile.setBaseSalary(new BigDecimal("8000"));
        profile.setFixedBonus(new BigDecimal("500"));
        SimulateResponse r = simulate(1L, null, 5, 2026);
        // Sans retenue spécifique : netPay = brut - CNSS - AMO - IR
        BigDecimal expected = r.getGrossSalary()
                .subtract(r.getCnssAmount())
                .subtract(r.getAmoAmount())
                .subtract(r.getIrAmount());
        assertEquals(0, r.getNetPay().compareTo(expected), "Net à payer cohérent");
    }

    @Test
    void inactive_profile_throws() {
        profile.setActive(false);
        assertThrows(ApiException.class, () -> simulate(1L, null, 5, 2026));
    }

    @Test
    void missing_profile_throws() {
        when(profileRepository.findByEmployeeId(999L)).thenReturn(Optional.empty());
        assertThrows(ApiException.class, () -> simulate(999L, null, 5, 2026));
    }

    // =====================================================================
    // Tâche 1 — Tests retenue spécifique (6 nouveaux tests)
    // =====================================================================

    @Test
    void retenue_zero_aucun_impact() {
        // Si retenueSpecifique = 0, le comportement est identique à sans retenue
        SimulateResponse sans  = simulate(1L, null, 5, 2026);
        SimulateResponse avec0 = simulateAvecRetenue(1L, null, 5, 2026,
                BigDecimal.ZERO, "");

        assertEquals(0, sans.getNetPay().compareTo(avec0.getNetPay()),
                "Net identique quand retenue = 0");
        // Aucune ligne RETENUE_SPECIFIQUE ne doit apparaître
        boolean retenueLinePresente = avec0.getLines().stream()
                .anyMatch(l -> "RETENUE_SPECIFIQUE".equals(l.getCode()));
        assertFalse(retenueLinePresente, "Pas de ligne RETENUE_SPECIFIQUE quand montant = 0");
    }

    @Test
    void retenue_200_diminue_net_de_200() {
        SimulateResponse sans    = simulate(1L, null, 5, 2026);
        SimulateResponse avec200 = simulateAvecRetenue(1L, null, 5, 2026,
                new BigDecimal("200"), "Avance sur salaire");

        BigDecimal difference = sans.getNetPay().subtract(avec200.getNetPay());
        assertEquals(0, difference.compareTo(new BigDecimal("200.00")),
                "Le net diminue exactement de 200 DH");
        assertEquals(0, avec200.getRetenueSpecifique().compareTo(new BigDecimal("200.00")));
    }

    @Test
    void retenue_sans_motif_throws_bad_request() {
        // retenueSpecifique > 0 mais motif absent => ApiException BAD_REQUEST
        ApiException ex = assertThrows(ApiException.class, () ->
                simulateAvecRetenue(1L, null, 5, 2026,
                        new BigDecimal("100"), ""));
        assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    void retenue_motif_blank_throws_bad_request() {
        // Motif composé uniquement d'espaces => doit lever une exception
        ApiException ex = assertThrows(ApiException.class, () ->
                simulateAvecRetenue(1L, null, 5, 2026,
                        new BigDecimal("50"), "   "));
        assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    void retenue_ne_modifie_pas_brut_ni_cotisations() {
        SimulateResponse sans    = simulate(1L, null, 5, 2026);
        SimulateResponse avec300 = simulateAvecRetenue(1L, null, 5, 2026,
                new BigDecimal("300"), "Pénalité");

        // grossSalary, cnssAmount, amoAmount, taxableNet, irAmount restent identiques
        assertEquals(0, sans.getGrossSalary().compareTo(avec300.getGrossSalary()),
                "Brut inchangé");
        assertEquals(0, sans.getCnssAmount().compareTo(avec300.getCnssAmount()),
                "CNSS inchangée");
        assertEquals(0, sans.getAmoAmount().compareTo(avec300.getAmoAmount()),
                "AMO inchangée");
        assertEquals(0, sans.getTaxableNet().compareTo(avec300.getTaxableNet()),
                "Net imposable inchangé");
        assertEquals(0, sans.getIrAmount().compareTo(avec300.getIrAmount()),
                "IR inchangé");
    }

    @Test
    void retenue_apparait_dans_lines_avec_bon_label_et_code() {
        SimulateResponse r = simulateAvecRetenue(1L, null, 5, 2026,
                new BigDecimal("150"), "Avance sur salaire");

        PayslipLineDTO retenueLines = r.getLines().stream()
                .filter(l -> "RETENUE_SPECIFIQUE".equals(l.getCode()))
                .findFirst()
                .orElse(null);

        assertNotNull(retenueLines, "La ligne RETENUE_SPECIFIQUE doit exister");
        assertEquals("Retenue spécifique - Avance sur salaire", retenueLines.getLabel());
        assertEquals(PayslipLineDTO.LineType.DEDUCTION, retenueLines.getType());
        assertEquals(0, retenueLines.getAmount().compareTo(new BigDecimal("150.00")));
        assertTrue(retenueLines.isManual(), "La ligne doit être manual = true");
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    private SimulateResponse simulate(Long empId, LocalDate dateEmbauche, int mois, int annee) {
        return service.simulate(SimulateRequest.builder()
                .employeeId(empId)
                .mois(mois).annee(annee)
                .dateEmbauche(dateEmbauche)
                .variables(List.of())
                .build());
    }

    private SimulateResponse simulateAvecRetenue(Long empId, LocalDate dateEmbauche,
                                                  int mois, int annee,
                                                  BigDecimal retenueSpecifique,
                                                  String motifRetenue) {
        return service.simulate(SimulateRequest.builder()
                .employeeId(empId)
                .mois(mois).annee(annee)
                .dateEmbauche(dateEmbauche)
                .variables(List.of())
                .retenueSpecifique(retenueSpecifique)
                .motifRetenue(motifRetenue)
                .build());
    }

    private PayrollParameter param(String code, String value) {
        return PayrollParameter.builder().code(code).label(code)
                .value(new BigDecimal(value)).active(true).build();
    }

    private List<IncomeTaxBracket> defaultBrackets() {
        return List.of(
                bracket("0", "40000", "0", "0"),
                bracket("40001", "60000", "10", "4000"),
                bracket("60001", "80000", "20", "10000"),
                bracket("80001", "100000", "30", "18000"),
                bracket("100001", "180000", "34", "22000"),
                bracket("180001", null, "37", "27400")
        );
    }

    private IncomeTaxBracket bracket(String min, String max, String rate, String deduction) {
        return IncomeTaxBracket.builder()
                .minAnnualIncome(new BigDecimal(min))
                .maxAnnualIncome(max != null ? new BigDecimal(max) : null)
                .rate(new BigDecimal(rate))
                .deduction(new BigDecimal(deduction))
                .active(true).build();
    }

    private List<SeniorityRule> defaultSeniorityRules() {
        return List.of(
                SeniorityRule.builder().minYears(0).maxYears(2).rate(BigDecimal.ZERO).active(true).build(),
                SeniorityRule.builder().minYears(2).maxYears(5).rate(new BigDecimal("5")).active(true).build(),
                SeniorityRule.builder().minYears(5).maxYears(12).rate(new BigDecimal("10")).active(true).build(),
                SeniorityRule.builder().minYears(12).maxYears(20).rate(new BigDecimal("15")).active(true).build(),
                SeniorityRule.builder().minYears(20).maxYears(25).rate(new BigDecimal("20")).active(true).build(),
                SeniorityRule.builder().minYears(25).maxYears(null).rate(new BigDecimal("25")).active(true).build()
        );
    }
}
