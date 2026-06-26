package ma.pfe.rh.payroll.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import ma.pfe.rh.payroll.domain.Payslip;
import ma.pfe.rh.payroll.domain.PayslipLine;
import ma.pfe.rh.payroll.domain.PayslipLineType;
import ma.pfe.rh.payroll.domain.PayslipStatus;
import ma.pfe.rh.payroll.dto.BatchGenerateRowRequest;
import ma.pfe.rh.payroll.dto.BatchGenerateRowResult;
import ma.pfe.rh.payroll.dto.PayslipLineDTO;
import ma.pfe.rh.payroll.dto.SimulateRequest;
import ma.pfe.rh.payroll.dto.SimulateResponse;
import ma.pfe.rh.payroll.dto.VariableElementDTO;
import ma.pfe.rh.payroll.repo.PayslipLineRepository;
import ma.pfe.rh.payroll.repo.PayslipRepository;
import ma.pfe.rh.payroll.storage.PayrollFileStorage;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Service dédié à la génération d'un bulletin dans le cadre du batch.
 * Chaque ligne s'exécute dans sa propre transaction (REQUIRES_NEW) pour que
 * l'échec d'une ligne ne provoque pas le rollback des lignes déjà générées.
 *
 * Pas d'auto-invocation : ce service est injecté dans PayrollService.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PayrollBatchItemService {

    private final PayslipRepository          payslipRepository;
    private final PayslipLineRepository      payslipLineRepository;
    private final PayrollCalculationService  calculationService;
    private final PayslipPdfService          pdfService;
    private final PayrollFileStorage         fileStorage;

    /**
     * Génère (ou constate la génération déjà faite) d'un bulletin pour une ligne
     * du batch.  La méthode est transactionnelle en REQUIRES_NEW : si elle échoue,
     * seule cette ligne est annulée ; les autres ne sont pas impactées.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public BatchGenerateRowResult generateOneRow(BatchGenerateRowRequest row,
                                                  int mois,
                                                  int annee,
                                                  Long rhUserId) {
        try {
            // ── 1. Bulletin VALIDATED / SENT déjà présent → ne pas régénérer ──
            Optional<Payslip> existingOpt =
                    payslipRepository.findByEmployeeIdAndMoisAndAnnee(row.getEmployeeId(), mois, annee);

            if (existingOpt.isPresent()) {
                Payslip existing = existingOpt.get();

                if (existing.getStatus() == PayslipStatus.VALIDATED
                        || existing.getStatus() == PayslipStatus.SENT) {
                    
                    String finalPdfUrl = existing.getPdfUrl();
                    if (finalPdfUrl == null || finalPdfUrl.isBlank()) {
                        finalPdfUrl = existing.getFichierUrl();
                    }

                    return BatchGenerateRowResult.builder()
                            .employeeId(row.getEmployeeId())
                            .success(true)
                            .status(existing.getStatus().name())
                            .pdfUrl(finalPdfUrl)
                            .netPay(existing.getNetPay())
                            .build();
                }
            }

            // ── 2. Construire les variables à partir des champs plats du DTO ──
            List<VariableElementDTO> variables = buildVariables(
                    row.getTransport(),
                    row.getPanier(),
                    row.getBonus(),
                    row.getIndemnite());

            BigDecimal retenue = row.getRetenueSpecifique() != null ? row.getRetenueSpecifique() : BigDecimal.ZERO;
            String     motif   = row.getMotifRetenue();

            // ── 3. Calcul via le moteur ──
            SimulateRequest simReq = SimulateRequest.builder()
                    .employeeId(row.getEmployeeId())
                    .mois(mois)
                    .annee(annee)
                    .dateEmbauche(row.getEmployeeHireDate())
                    .variables(variables)
                    .retenueSpecifique(retenue)
                    .motifRetenue(motif)
                    .build();

            SimulateResponse calc = calculationService.simulate(simReq);

            Instant now = Instant.now();

            // ── 4. Créer ou mettre à jour le DRAFT ──
            Payslip payslip;
            if (existingOpt.isPresent()) {
                // DRAFT existant : mise à jour
                payslip = existingOpt.get();
                payslip.setUpdatedAt(now);
            } else {
                // Nouveau DRAFT
                payslip = Payslip.builder()
                        .employeeId(row.getEmployeeId())
                        .mois(mois)
                        .annee(annee)
                        .status(PayslipStatus.DRAFT)
                        .createdAt(now)
                        .updatedAt(now)
                        .build();
            }

            // Snapshot employé
            payslip.setEmployeeFirstName(row.getEmployeeFirstName());
            payslip.setEmployeeLastName(row.getEmployeeLastName());
            payslip.setEmployeeMatricule(row.getEmployeeMatricule());
            payslip.setEmployeePoste(row.getEmployeePoste());
            payslip.setEmployeeDepartement(row.getEmployeeDepartement());
            payslip.setEmployeeCnss(row.getEmployeeCnss());
            payslip.setEmployeeRib(row.getEmployeeRib());
            payslip.setEmployeeBankName(row.getEmployeeBankName());
            payslip.setEmployeeHireDate(row.getEmployeeHireDate());

            // Montants calculés
            payslip.setGrossSalary(calc.getGrossSalary());
            payslip.setCnssAmount(calc.getCnssAmount());
            payslip.setAmoAmount(calc.getAmoAmount());
            payslip.setTaxableNet(calc.getTaxableNet());
            payslip.setIrAmount(calc.getIrAmount());
            payslip.setNetPay(calc.getNetPay());

            calc.getLines().forEach(line -> {
                if ("Salaire de base".equals(line.getLabel()))  payslip.setBaseSalary(line.getAmount());
                if ("Prime fixe".equals(line.getLabel()))       payslip.setFixedBonus(line.getAmount());
                if ("Prime ancienneté".equals(line.getLabel())) payslip.setSeniorityBonus(line.getAmount());
            });

            Payslip saved = payslipRepository.save(payslip);

            // Lignes détaillées
            payslipLineRepository.deleteByPayslipId(saved.getId());
            List<PayslipLine> dbLines = calc.getLines().stream().map(l -> {
                String code = (l.getCode() != null && !l.getCode().isBlank())
                        ? l.getCode()
                        : labelToCode(l.getLabel());
                return PayslipLine.builder()
                        .payslipId(saved.getId())
                        .code(code)
                        .label(l.getLabel())
                        .type(l.getType() == PayslipLineDTO.LineType.GAIN
                                ? PayslipLineType.GAIN : PayslipLineType.DEDUCTION)
                        .baseAmount(l.getBase())
                        .rate(l.getRate())
                        .gainAmount(l.getType()      == PayslipLineDTO.LineType.GAIN ? l.getAmount() : null)
                        .deductionAmount(l.getType() == PayslipLineDTO.LineType.DEDUCTION ? l.getAmount() : null)
                        .manual(l.isManual())
                        .build();
            }).toList();
            payslipLineRepository.saveAll(dbLines);

            // ── 5. Générer le PDF et stocker ──
            List<PayslipLine> linesForPdf = payslipLineRepository.findByPayslipId(saved.getId());
            byte[] pdfBytes = pdfService.generate(saved, linesForPdf);
            String pdfUrl   = fileStorage.storePdfBytes(saved.getEmployeeId(), mois, annee, pdfBytes);

            // ── 6. Passer en VALIDATED ──
            saved.setStatus(PayslipStatus.VALIDATED);
            saved.setValidatedBy(rhUserId);
            saved.setValidatedAt(now);
            saved.setUpdatedAt(now);
            saved.setPdfUrl(pdfUrl);
            Payslip finalSaved = payslipRepository.save(saved);

            return BatchGenerateRowResult.builder()
                    .employeeId(row.getEmployeeId())
                    .success(true)
                    .status(PayslipStatus.VALIDATED.name())
                    .pdfUrl(finalSaved.getPdfUrl())
                    .netPay(finalSaved.getNetPay())
                    .build();

        } catch (Exception e) {
            log.error("Erreur génération bulletin batch pour employé #{}: {}",
                    row.getEmployeeId(), e.getMessage(), e);
            return BatchGenerateRowResult.builder()
                    .employeeId(row.getEmployeeId())
                    .success(false)
                    .error(e.getMessage())
                    .build();
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private List<VariableElementDTO> buildVariables(BigDecimal transport, BigDecimal panier,
                                                     BigDecimal bonus, BigDecimal indemnite) {
        List<VariableElementDTO> vars = new ArrayList<>();
        if (pos(transport)) vars.add(v("PRIME_TRANSPORT", transport));
        if (pos(panier))    vars.add(v("PRIME_PANIER",    panier));
        if (pos(bonus))     vars.add(v("BONUS",           bonus));
        if (pos(indemnite)) vars.add(v("INDEMNITE",       indemnite));
        return vars;
    }

    private boolean pos(BigDecimal v) {
        return v != null && v.compareTo(BigDecimal.ZERO) > 0;
    }

    private VariableElementDTO v(String code, BigDecimal amount) {
        return VariableElementDTO.builder().code(code).amount(amount).build();
    }

    private String labelToCode(String label) {
        return switch (label) {
            case "Salaire de base"   -> "SALAIRE_BASE";
            case "Prime fixe"        -> "PRIME_FIXE";
            case "Prime ancienneté"  -> "PRIME_ANCIENNETE";
            case "Prime transport"   -> "PRIME_TRANSPORT";
            case "Prime panier"      -> "PRIME_PANIER";
            case "Bonus"             -> "BONUS";
            case "Indemnité"         -> "INDEMNITE";
            case "CNSS"              -> "CNSS";
            case "AMO"               -> "AMO";
            case "IR"                -> "IR";
            default -> label.toUpperCase().replaceAll("[^A-Z0-9]", "_");
        };
    }
}
