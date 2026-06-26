package ma.pfe.rh.payroll.service;

import lombok.RequiredArgsConstructor;
import ma.pfe.rh.payroll.domain.IncomeTaxBracket;
import ma.pfe.rh.payroll.domain.PayrollParameter;
import ma.pfe.rh.payroll.domain.SeniorityRule;
import ma.pfe.rh.payroll.dto.IncomeTaxBracketDTO;
import ma.pfe.rh.payroll.dto.PayrollParameterDTO;
import ma.pfe.rh.payroll.dto.SeniorityRuleDTO;
import ma.pfe.rh.payroll.repo.IncomeTaxBracketRepository;
import ma.pfe.rh.payroll.repo.PayrollParameterRepository;
import ma.pfe.rh.payroll.repo.SeniorityRuleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PayrollParameterService {

    private final PayrollParameterRepository parameterRepository;
    private final IncomeTaxBracketRepository taxBracketRepository;
    private final SeniorityRuleRepository seniorityRuleRepository;

    // --- Paramètres globaux ---

    public List<PayrollParameterDTO> getAllParameters() {
        return parameterRepository.findByActiveTrue().stream()
                .map(this::toParamDTO)
                .toList();
    }

    @Transactional
    public List<PayrollParameterDTO> updateParameters(List<PayrollParameterDTO> dtos) {
        for (PayrollParameterDTO dto : dtos) {
            PayrollParameter p = parameterRepository.findByCodeAndActiveTrue(dto.getCode())
                    .orElse(null);
            if (p != null) {
                p.setValue(dto.getValue());
                if (dto.getLabel() != null && !dto.getLabel().isBlank()) {
                    p.setLabel(dto.getLabel());
                }
                parameterRepository.save(p);
            }
        }
        return getAllParameters();
    }

    // --- Tranches IR ---

    public List<IncomeTaxBracketDTO> getAllTaxBrackets() {
        return taxBracketRepository.findByActiveTrueOrderByMinAnnualIncomeAsc().stream()
                .map(this::toBracketDTO)
                .toList();
    }

    @Transactional
    public List<IncomeTaxBracketDTO> updateTaxBrackets(List<IncomeTaxBracketDTO> dtos) {
        // Approche simple PFE : désactiver les anciennes, insérer les nouvelles
        taxBracketRepository.findByActiveTrueOrderByMinAnnualIncomeAsc()
                .forEach(b -> {
                    b.setActive(false);
                    taxBracketRepository.save(b);
                });
        for (IncomeTaxBracketDTO dto : dtos) {
            IncomeTaxBracket b = IncomeTaxBracket.builder()
                    .minAnnualIncome(dto.getMinAnnualIncome())
                    .maxAnnualIncome(dto.getMaxAnnualIncome())
                    .rate(dto.getRate())
                    .deduction(dto.getDeduction())
                    .active(true)
                    .build();
            taxBracketRepository.save(b);
        }
        return getAllTaxBrackets();
    }

    // --- Règles ancienneté ---

    public List<SeniorityRuleDTO> getAllSeniorityRules() {
        return seniorityRuleRepository.findByActiveTrueOrderByMinYearsAsc().stream()
                .map(this::toRuleDTO)
                .toList();
    }

    @Transactional
    public List<SeniorityRuleDTO> updateSeniorityRules(List<SeniorityRuleDTO> dtos) {
        // Approche simple PFE : désactiver les anciennes, insérer les nouvelles
        seniorityRuleRepository.findByActiveTrueOrderByMinYearsAsc()
                .forEach(r -> {
                    r.setActive(false);
                    seniorityRuleRepository.save(r);
                });
        for (SeniorityRuleDTO dto : dtos) {
            SeniorityRule r = SeniorityRule.builder()
                    .minYears(dto.getMinYears())
                    .maxYears(dto.getMaxYears())
                    .rate(dto.getRate())
                    .active(true)
                    .build();
            seniorityRuleRepository.save(r);
        }
        return getAllSeniorityRules();
    }

    // --- Mappers ---

    private PayrollParameterDTO toParamDTO(PayrollParameter p) {
        return PayrollParameterDTO.builder()
                .id(p.getId())
                .code(p.getCode())
                .label(p.getLabel())
                .value(p.getValue())
                .build();
    }

    private IncomeTaxBracketDTO toBracketDTO(IncomeTaxBracket b) {
        return IncomeTaxBracketDTO.builder()
                .id(b.getId())
                .minAnnualIncome(b.getMinAnnualIncome())
                .maxAnnualIncome(b.getMaxAnnualIncome())
                .rate(b.getRate())
                .deduction(b.getDeduction())
                .build();
    }

    private SeniorityRuleDTO toRuleDTO(SeniorityRule r) {
        return SeniorityRuleDTO.builder()
                .id(r.getId())
                .minYears(r.getMinYears())
                .maxYears(r.getMaxYears())
                .rate(r.getRate())
                .build();
    }
}
