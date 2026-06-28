package ma.pfe.rh.payroll.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import ma.pfe.rh.payroll.domain.Payslip;
import ma.pfe.rh.payroll.domain.PayslipLine;
import ma.pfe.rh.payroll.domain.PayslipLineType;
import ma.pfe.rh.payroll.domain.PayslipStatus;
import ma.pfe.rh.payroll.dto.BatchGenerateRequest;
import ma.pfe.rh.payroll.dto.BatchGenerateResponse;
import ma.pfe.rh.payroll.dto.BatchGenerateRowResult;
import ma.pfe.rh.payroll.dto.BatchPayslipRowRequest;
import ma.pfe.rh.payroll.dto.BatchPayslipRowResponse;
import ma.pfe.rh.payroll.dto.BatchSimulateRequest;
import ma.pfe.rh.payroll.dto.BatchSimulateResponse;
import ma.pfe.rh.payroll.dto.PayslipLineDTO;
import ma.pfe.rh.payroll.dto.PayslipResponse;
import ma.pfe.rh.payroll.dto.PayslipSaveRequest;
import ma.pfe.rh.payroll.dto.SimulateRequest;
import ma.pfe.rh.payroll.dto.SimulateResponse;
import ma.pfe.rh.payroll.dto.VariableElementDTO;
import ma.pfe.rh.payroll.kafka.PayrollKafkaProducer;
import ma.pfe.rh.payroll.repo.PayslipLineRepository;
import ma.pfe.rh.payroll.repo.PayslipRepository;
import ma.pfe.rh.payroll.storage.PayrollFileStorage;
import ma.pfe.rh.payroll.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class PayrollService {

    private final PayslipRepository payslipRepository;
    private final PayslipLineRepository payslipLineRepository;
    private final PayrollFileStorage payrollFileStorage;
    private final PayrollKafkaProducer payrollKafkaProducer;
    private final PayrollCalculationService calculationService;
    private final PayslipPdfService payslipPdfService;
    private final PayrollBatchItemService batchItemService;

    // ---- Historique employé (RH : inclut les DRAFT) ----

    public List<PayslipResponse> payslipsForRh(long employeeId) {
        return payslipRepository.findByEmployeeIdOrderByAnneeDescMoisDesc(employeeId).stream()
                .map(PayslipResponse::from)
                .toList();
    }

    // ---- Espace Employé (retourne uniquement les bulletins SENT) ----

    public List<PayslipResponse> payslipsForRhPeriod(int mois, int annee) {
        if (mois < 1 || mois > 12) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Mois invalide");
        }
        return payslipRepository.findByMoisAndAnneeOrderByUpdatedAtDesc(mois, annee).stream()
                .map(PayslipResponse::from)
                .toList();
    }

    public List<PayslipResponse> payslipsForEmployee(long employeeId) {
        return payslipRepository.findByEmployeeIdAndStatusOrderByAnneeDescMoisDesc(employeeId, PayslipStatus.SENT)
                .stream()
                .map(PayslipResponse::from)
                .toList();
    }

    // ---- Ancien upload PDF (inchangé) ----

    @Transactional
    public PayslipResponse uploadPayslip(long rhUserId, long employeeId, int mois, int annee, MultipartFile file)
            throws IOException {
        if (mois < 1 || mois > 12) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Mois invalide");
        }
        String url = payrollFileStorage.storePayslip(employeeId, mois, annee, file);
        Instant now = Instant.now();
        Payslip p = Payslip.builder()
                .employeeId(employeeId)
                .mois(mois)
                .annee(annee)
                .fichierUrl(url)
                .uploadedBy(rhUserId)
                .createdAt(now)
                .status(PayslipStatus.VALIDATED) // ancien upload PDF = directement validé
                .build();
        Payslip saved = payslipRepository.save(p);

        Map<String, Object> payload = new HashMap<>();
        payload.put("payslipId", saved.getId());
        payload.put("employeeId", saved.getEmployeeId());
        payload.put("mois", saved.getMois());
        payload.put("annee", saved.getAnnee());
        payrollKafkaProducer.payslipUploaded(payload);

        return PayslipResponse.from(saved);
    }

    // ---- Lot 3 : Créer ou mettre à jour un DRAFT ----

    @Transactional
    public PayslipResponse createOrUpdateDraft(PayslipSaveRequest req) {
        if (req.getMois() < 1 || req.getMois() > 12) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Mois invalide");
        }

        // Vérifier si un bulletin VALIDATED ou SENT existe déjà
        if (payslipRepository.existsByEmployeeIdAndMoisAndAnneeAndStatusNot(
                req.getEmployeeId(), req.getMois(), req.getAnnee(), PayslipStatus.DRAFT)) {
            throw new ApiException(HttpStatus.CONFLICT,
                    "Un bulletin validé ou envoyé existe déjà pour cette période. Modification impossible.");
        }

        // Calcul via le moteur (baseSalary/fixedBonus viennent du profil, pas du
        // frontend)
        SimulateRequest simReq = SimulateRequest.builder()
                .employeeId(req.getEmployeeId())
                .mois(req.getMois())
                .annee(req.getAnnee())
                .dateEmbauche(req.getEmployeeHireDate())
                .variables(req.getVariables())
                // Tâche 1 — retenue spécifique propagée depuis le frontend
                .retenueSpecifique(req.getRetenueSpecifique())
                .motifRetenue(req.getMotifRetenue())
                .build();
        SimulateResponse calc = calculationService.simulate(simReq);

        Instant now = Instant.now();

        // Chercher DRAFT existant
        Optional<Payslip> existing = payslipRepository.findByEmployeeIdAndMoisAndAnnee(
                req.getEmployeeId(), req.getMois(), req.getAnnee());

        Payslip payslip;
        if (existing.isPresent()) {
            // Mise à jour du DRAFT existant
            payslip = existing.get();
            if (payslip.getStatus() != PayslipStatus.DRAFT) {
                throw new ApiException(HttpStatus.CONFLICT,
                        "Bulletin non-DRAFT : modification refusée (statut=" + payslip.getStatus() + ").");
            }
            payslip.setUpdatedAt(now);
        } else {
            // Nouveau DRAFT
            payslip = Payslip.builder()
                    .employeeId(req.getEmployeeId())
                    .mois(req.getMois())
                    .annee(req.getAnnee())
                    .status(PayslipStatus.DRAFT)
                    .createdAt(now)
                    .updatedAt(now)
                    .build();
        }

        // Snapshot employé
        payslip.setEmployeeFirstName(req.getEmployeeFirstName());
        payslip.setEmployeeLastName(req.getEmployeeLastName());
        payslip.setEmployeeMatricule(req.getEmployeeMatricule());
        payslip.setEmployeePoste(req.getEmployeePoste());
        payslip.setEmployeeDepartement(req.getEmployeeDepartement());
        payslip.setEmployeeCnss(req.getEmployeeCnss());
        payslip.setEmployeeRib(req.getEmployeeRib());
        payslip.setEmployeeBankName(req.getEmployeeBankName());
        payslip.setEmployeeHireDate(req.getEmployeeHireDate());

        // Montants calculés
        payslip.setGrossSalary(calc.getGrossSalary());
        payslip.setCnssAmount(calc.getCnssAmount());
        payslip.setAmoAmount(calc.getAmoAmount());
        payslip.setTaxableNet(calc.getTaxableNet());
        payslip.setIrAmount(calc.getIrAmount());
        payslip.setNetPay(calc.getNetPay());

        // Extraire baseSalary, fixedBonus, seniorityBonus depuis les lignes calculées
        calc.getLines().forEach(line -> {
            if ("Salaire de base".equals(line.getLabel()))
                payslip.setBaseSalary(line.getAmount());
            if ("Prime fixe".equals(line.getLabel()))
                payslip.setFixedBonus(line.getAmount());
            if ("Prime ancienneté".equals(line.getLabel()))
                payslip.setSeniorityBonus(line.getAmount());
        });

        Payslip saved = payslipRepository.save(payslip);

        // Recréer les lignes (supprimer les anciennes si mise à jour)
        payslipLineRepository.deleteByPayslipId(saved.getId());
        List<PayslipLine> dbLines = calc.getLines().stream().map(l -> {
            // Utiliser le code venu du DTO en priorité, sinon dériver du label
            // (rétrocompat)
            String code = (l.getCode() != null && !l.getCode().isBlank())
                    ? l.getCode()
                    : labelToCode(l.getLabel());
            return PayslipLine.builder()
                    .payslipId(saved.getId())
                    .code(code)
                    .label(l.getLabel())
                    .type(l.getType() == PayslipLineDTO.LineType.GAIN ? PayslipLineType.GAIN
                            : PayslipLineType.DEDUCTION)
                    .baseAmount(l.getBase())
                    .rate(l.getRate())
                    .gainAmount(l.getType() == PayslipLineDTO.LineType.GAIN ? l.getAmount() : null)
                    .deductionAmount(l.getType() == PayslipLineDTO.LineType.DEDUCTION ? l.getAmount() : null)
                    .manual(l.isManual())
                    .build();
        }).toList();
        payslipLineRepository.saveAll(dbLines);

        return PayslipResponse.from(saved, calc.getLines());
    }

    // ---- Lot 4 : Validation + génération PDF ----

    @Transactional
    public PayslipResponse validate(long payslipId, long rhUserId) throws IOException {
        Payslip payslip = payslipRepository.findById(payslipId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Bulletin introuvable #" + payslipId));

        if (payslip.getStatus() != PayslipStatus.DRAFT) {
            throw new ApiException(HttpStatus.CONFLICT,
                    "Ce bulletin est déjà " + payslip.getStatus() + " — validation refusée.");
        }

        List<PayslipLine> lines = payslipLineRepository.findByPayslipId(payslipId);
        if (lines.isEmpty()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Impossible de valider un bulletin sans lignes. Enregistrez d'abord le bulletin.");
        }

        // Générer le PDF depuis les lignes en base (montants non recalculés)
        byte[] pdfBytes;
        try {
            pdfBytes = payslipPdfService.generate(payslip, lines);
        } catch (Exception e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Échec de la génération du PDF : " + e.getMessage());
        }

        // Stocker le PDF
        String pdfUrl;
        try {
            pdfUrl = payrollFileStorage.storePdfBytes(
                    payslip.getEmployeeId(), payslip.getMois(), payslip.getAnnee(), pdfBytes);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Échec du stockage du PDF : " + e.getMessage());
        }

        // Valider uniquement après succès complet
        Instant now = Instant.now();
        payslip.setStatus(PayslipStatus.VALIDATED);
        payslip.setValidatedBy(rhUserId);
        payslip.setValidatedAt(now);
        payslip.setUpdatedAt(now);
        payslip.setPdfUrl(pdfUrl);
        Payslip saved = payslipRepository.save(payslip);

        // Construire la réponse avec les lignes (inclut le code pour le frontend)
        List<PayslipLineDTO> lineDTOs = lines.stream()
                .map(l -> PayslipLineDTO.builder()
                        .code(l.getCode())
                        .label(l.getLabel())
                        .type(l.getType() == PayslipLineType.GAIN
                                ? PayslipLineDTO.LineType.GAIN
                                : PayslipLineDTO.LineType.DEDUCTION)
                        .base(l.getBaseAmount())
                        .rate(l.getRate())
                        .amount(l.getType() == PayslipLineType.GAIN ? l.getGainAmount() : l.getDeductionAmount())
                        .manual(l.isManual())
                        .build())
                .toList();
        return PayslipResponse.from(saved, lineDTOs);
    }

    // ---- Lot 3 : Détail bulletin par ID ----

    @Transactional(readOnly = true)
    public PayslipResponse getPayslip(long id) {
        Payslip p = payslipRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Bulletin introuvable #" + id));
        List<PayslipLineDTO> lines = payslipLineRepository.findByPayslipId(id).stream()
                .map(l -> PayslipLineDTO.builder()
                        .code(l.getCode())
                        .label(l.getLabel())
                        .type(l.getType() == PayslipLineType.GAIN
                                ? PayslipLineDTO.LineType.GAIN
                                : PayslipLineDTO.LineType.DEDUCTION)
                        .base(l.getBaseAmount())
                        .rate(l.getRate())
                        .amount(l.getType() == PayslipLineType.GAIN ? l.getGainAmount() : l.getDeductionAmount())
                        .manual(l.isManual())
                        .build())
                .toList();
        return PayslipResponse.from(p, lines);
    }

    // ---- Lot 5 : Envoi bulletin à l'employé ----

    @Transactional
    public PayslipResponse send(long payslipId) {
        Payslip payslip = payslipRepository.findById(payslipId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Bulletin introuvable #" + payslipId));

        if (payslip.getStatus() == PayslipStatus.SENT) {
            // Déjà envoyé : retourner le bulletin sans republier Kafka
            return PayslipResponse.from(payslip);
        }

        if (payslip.getStatus() == PayslipStatus.DRAFT) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Le bulletin doit être validé avant l'envoi.");
        }

        // Statut == VALIDATED
        if (payslip.getPdfUrl() == null || payslip.getPdfUrl().isBlank()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Le PDF n'a pas encore été généré pour ce bulletin.");
        }

        // Publier l'événement Kafka AVANT de modifier le statut
        Map<String, Object> payload = new HashMap<>();
        payload.put("payslipId", payslip.getId());
        payload.put("employeeId", payslip.getEmployeeId());
        payload.put("mois", payslip.getMois());
        payload.put("annee", payslip.getAnnee());
        payload.put("netPay", payslip.getNetPay());
        payload.put("pdfUrl", payslip.getPdfUrl());
        payrollKafkaProducer.payslipSent(payload); // si Kafka échoue, l'exception remonte et le @Transactional rollback

        // Mettre à jour le statut uniquement après succès Kafka
        Instant now = Instant.now();
        payslip.setStatus(PayslipStatus.SENT);
        payslip.setSentAt(now);
        payslip.setUpdatedAt(now);
        Payslip saved = payslipRepository.save(payslip);

        return PayslipResponse.from(saved);
    }

    // --- helper ---

    private String labelToCode(String label) {
        return switch (label) {
            case "Salaire de base" -> "SALAIRE_BASE";
            case "Prime fixe" -> "PRIME_FIXE";
            case "Prime ancienneté" -> "PRIME_ANCIENNETE";
            case "Prime transport" -> "PRIME_TRANSPORT";
            case "Prime panier" -> "PRIME_PANIER";
            case "Bonus" -> "BONUS";
            case "Indemnité" -> "INDEMNITE";
            case "CNSS" -> "CNSS";
            case "AMO" -> "AMO";
            case "IR" -> "IR";
            default -> label.toUpperCase().replaceAll("[^A-Z0-9]", "_");
        };
    }

    // ===== Tâche 4 : Génération groupée =====

    /**
     * Orchestre la génération ligne par ligne.
     * Chaque ligne est traitée dans sa propre transaction (REQUIRES_NEW) via batchItemService,
     * ce qui garantit qu'une erreur sur une ligne n'annule pas les autres bulletins déjà générés.
     */
    public BatchGenerateResponse batchGenerate(BatchGenerateRequest req, Long rhUserId) {
        if (req.getMois() < 1 || req.getMois() > 12) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Mois invalide");
        }

        List<BatchGenerateRowResult> results = new ArrayList<>();
        for (var row : req.getRows()) {
            // Chaque appel s'exécute dans REQUIRES_NEW : isolation complète par ligne
            BatchGenerateRowResult result =
                    batchItemService.generateOneRow(row, req.getMois(), req.getAnnee(), rhUserId);
            results.add(result);
        }

        return BatchGenerateResponse.builder().results(results).build();
    }

    // ===== Tâche 3 : Simulation groupée (READ-ONLY — aucune sauvegarde) =====

    private static final Set<String> VARIABLE_CODES = Set.of("PRIME_TRANSPORT", "PRIME_PANIER", "BONUS", "INDEMNITE");

    @Transactional(readOnly = true)
    public BatchSimulateResponse batchSimulate(BatchSimulateRequest req) {

        if (req.getMois() < 1 || req.getMois() > 12) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Mois invalide");
        }

        List<BatchPayslipRowResponse> results = new ArrayList<>();

        for (BatchPayslipRowRequest row : req.getRows()) {
            results.add(simulateOneRow(row, req.getMois(), req.getAnnee()));
        }

        return BatchSimulateResponse.builder().rows(results).build();
    }

    /**
     * Simule une seule ligne sans aucune écriture en base.
     * Ordre de priorité :
     * 1. Bulletin VALIDATED/SENT -> non générable, retourne netPay et pdfUrl
     * existants.
     * 2. DRAFT -> relit les variables du DRAFT et recalcule.
     * 3. Aucun bulletin -> simule avec les variables fournies (ou 0 par défaut).
     * 4. Profil absent -> hasProfile=false, generable=false.
     */
    private BatchPayslipRowResponse simulateOneRow(BatchPayslipRowRequest row, int mois, int annee) {

        try {
            // 1. Chercher un bulletin existant pour cet employé / période
            Optional<Payslip> existing = payslipRepository.findByEmployeeIdAndMoisAndAnnee(row.getEmployeeId(), mois,
                    annee);

            if (existing.isPresent()) {
                Payslip p = existing.get();

                // --- VALIDATED ou SENT : non modifiable ---
                if (p.getStatus() == PayslipStatus.VALIDATED || p.getStatus() == PayslipStatus.SENT) {
                    return buildDoneRow(row, p);
                }

                // --- DRAFT : récupérer les variables et recalculer ---
                if (p.getStatus() == PayslipStatus.DRAFT) {
                    return simulateDraftRow(row, p, mois, annee);
                }
            }

            // 2. Aucun bulletin : simulation pure (profil peut être absent)
            return simulateFreshRow(row, mois, annee);

        } catch (ApiException ae) {
            // Profil absent ou paramètres manquants -> erreur métier non bloquante
            if (ae.getStatus() == HttpStatus.NOT_FOUND) {
                return BatchPayslipRowResponse.builder()
                        .employeeId(row.getEmployeeId())
                        .hasProfile(false)
                        .generable(false)
                        .error(ae.getMessage())
                        .build();
            }
            throw ae;
        } catch (Exception e) {
            log.warn("Erreur calcul batch pour employé #{}: {}", row.getEmployeeId(), e.getMessage());
            return BatchPayslipRowResponse.builder()
                    .employeeId(row.getEmployeeId())
                    .hasProfile(false)
                    .generable(false)
                    .error(e.getMessage())
                    .build();
        }
    }

    /**
     * Ligne déjà VALIDATED ou SENT : on retourne les montants stockés sans
     * recalcul.
     */
    private BatchPayslipRowResponse buildDoneRow(BatchPayslipRowRequest row, Payslip p) {
        List<PayslipLine> lines = payslipLineRepository.findByPayslipId(p.getId());
        ExtractedVariables vars = extractVariablesFromLines(lines);

        return BatchPayslipRowResponse.builder()
                .employeeId(row.getEmployeeId())
                .hasProfile(true)
                .baseSalary(p.getBaseSalary())
                .fixedBonus(p.getFixedBonus())
                .transport(vars.transport())
                .panier(vars.panier())
                .bonus(vars.bonus())
                .indemnite(vars.indemnite())
                .retenueSpecifique(vars.retenue())
                .motifRetenue(vars.motif())
                .netPay(p.getNetPay())
                .status(p.getStatus().name())
                .pdfUrl(p.getPdfUrl())
                .generable(false)
                .build();
    }

    /**
     * Ligne DRAFT : relit les lignes en base pour récupérer variables + retenue,
     * puis recalcule via le moteur pour garder la cohérence.
     */
    private BatchPayslipRowResponse simulateDraftRow(BatchPayslipRowRequest row, Payslip p, int mois, int annee) {

        BigDecimal transport;
        BigDecimal panier;
        BigDecimal bonus;
        BigDecimal indemnite;
        BigDecimal retenue;
        String motif;

        if (row.isRecalculation()) {
            transport = getVariable(row.getVariables(), "PRIME_TRANSPORT");
            panier = getVariable(row.getVariables(), "PRIME_PANIER");
            bonus = getVariable(row.getVariables(), "BONUS");
            indemnite = getVariable(row.getVariables(), "INDEMNITE");
            retenue = row.getRetenueSpecifique() != null ? row.getRetenueSpecifique() : BigDecimal.ZERO;
            motif = row.getMotifRetenue();
        } else {
            List<PayslipLine> lines = payslipLineRepository.findByPayslipId(p.getId());
            ExtractedVariables vars = extractVariablesFromLines(lines);
            transport = vars.transport();
            panier = vars.panier();
            bonus = vars.bonus();
            indemnite = vars.indemnite();
            retenue = vars.retenue();
            motif = vars.motif();
        }

        List<VariableElementDTO> variables = buildVariables(transport, panier, bonus, indemnite);

        SimulateRequest simReq = SimulateRequest.builder()
                .employeeId(row.getEmployeeId())
                .mois(mois).annee(annee)
                .dateEmbauche(row.getEmployeeHireDate())
                .variables(variables)
                .retenueSpecifique(retenue)
                .motifRetenue(motif)
                .build();

        SimulateResponse calc = calculationService.simulate(simReq);
        BigDecimal bs = extractGain(calc, "SALAIRE_BASE");
        BigDecimal fb = extractGain(calc, "PRIME_FIXE");

        return BatchPayslipRowResponse.builder()
                .employeeId(row.getEmployeeId())
                .hasProfile(true)
                .baseSalary(bs)
                .fixedBonus(fb)
                .transport(transport)
                .panier(panier)
                .bonus(bonus)
                .indemnite(indemnite)
                .retenueSpecifique(retenue)
                .motifRetenue(motif)
                .netPay(calc.getNetPay())
                .status("DRAFT")
                .pdfUrl(null)
                .generable(true)
                .build();
    }

    /** Simulation pure (aucun bulletin existant). */
    private BatchPayslipRowResponse simulateFreshRow(BatchPayslipRowRequest row, int mois, int annee) {

        // Si pas de variables fournies, on utilise des zéros
        List<VariableElementDTO> variables = (row.getVariables() != null && !row.getVariables().isEmpty())
                ? row.getVariables()
                : buildVariables(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);

        BigDecimal retenue = (row.getRetenueSpecifique() != null) ? row.getRetenueSpecifique() : BigDecimal.ZERO;
        String motif = row.getMotifRetenue();

        SimulateRequest simReq = SimulateRequest.builder()
                .employeeId(row.getEmployeeId())
                .mois(mois).annee(annee)
                .dateEmbauche(row.getEmployeeHireDate())
                .variables(variables)
                .retenueSpecifique(retenue)
                .motifRetenue(motif)
                .build();

        SimulateResponse calc = calculationService.simulate(simReq);

        // Extraire transport, panier, bonus, indemnite depuis les lignes calculées
        BigDecimal t = extractGain(calc, "PRIME_TRANSPORT");
        BigDecimal pa = extractGain(calc, "PRIME_PANIER");
        BigDecimal b = extractGain(calc, "BONUS");
        BigDecimal i = extractGain(calc, "INDEMNITE");
        BigDecimal bs = extractGain(calc, "SALAIRE_BASE");
        BigDecimal fb = extractGain(calc, "PRIME_FIXE");

        return BatchPayslipRowResponse.builder()
                .employeeId(row.getEmployeeId())
                .hasProfile(true)
                .baseSalary(bs)
                .fixedBonus(fb)
                .transport(t)
                .panier(pa)
                .bonus(b)
                .indemnite(i)
                .retenueSpecifique(retenue)
                .motifRetenue(motif)
                .netPay(calc.getNetPay())
                .status(null)
                .pdfUrl(null)
                .generable(true)
                .build();
    }

    // --- Helpers batch ---

    private BigDecimal orZero(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    private BigDecimal extractGain(SimulateResponse calc, String code) {
        return calc.getLines().stream()
                .filter(l -> code.equals(l.getCode()) && l.getType() == PayslipLineDTO.LineType.GAIN)
                .map(PayslipLineDTO::getAmount)
                .findFirst()
                .orElse(BigDecimal.ZERO);
    }

    private List<VariableElementDTO> buildVariables(BigDecimal transport, BigDecimal panier,
            BigDecimal bonus, BigDecimal indemnite) {
        List<VariableElementDTO> vars = new ArrayList<>();
        if (transport != null && transport.compareTo(BigDecimal.ZERO) > 0)
            vars.add(VariableElementDTO.builder().code("PRIME_TRANSPORT").amount(transport).build());
        if (panier != null && panier.compareTo(BigDecimal.ZERO) > 0)
            vars.add(VariableElementDTO.builder().code("PRIME_PANIER").amount(panier).build());
        if (bonus != null && bonus.compareTo(BigDecimal.ZERO) > 0)
            vars.add(VariableElementDTO.builder().code("BONUS").amount(bonus).build());
        if (indemnite != null && indemnite.compareTo(BigDecimal.ZERO) > 0)
            vars.add(VariableElementDTO.builder().code("INDEMNITE").amount(indemnite).build());
        return vars;
    }

    private BigDecimal getVariable(List<VariableElementDTO> vars, String code) {
        if (vars == null)
            return BigDecimal.ZERO;
        return vars.stream()
                .filter(v -> code.equals(v.getCode()))
                .map(VariableElementDTO::getAmount)
                .findFirst()
                .orElse(BigDecimal.ZERO);
    }

    private record ExtractedVariables(BigDecimal transport, BigDecimal panier, BigDecimal bonus, BigDecimal indemnite,
            BigDecimal retenue, String motif) {
    }

    private ExtractedVariables extractVariablesFromLines(List<PayslipLine> lines) {
        BigDecimal transport = BigDecimal.ZERO;
        BigDecimal panier = BigDecimal.ZERO;
        BigDecimal bonus = BigDecimal.ZERO;
        BigDecimal indemnite = BigDecimal.ZERO;
        BigDecimal retenue = BigDecimal.ZERO;
        String motif = null;

        for (PayslipLine line : lines) {
            if (!line.isManual())
                continue;
            switch (line.getCode()) {
                case "PRIME_TRANSPORT" -> transport = orZero(line.getGainAmount());
                case "PRIME_PANIER" -> panier = orZero(line.getGainAmount());
                case "BONUS" -> bonus = orZero(line.getGainAmount());
                case "INDEMNITE" -> indemnite = orZero(line.getGainAmount());
                case "RETENUE_SPECIFIQUE" -> {
                    retenue = orZero(line.getDeductionAmount());
                    String label = line.getLabel();
                    int dash = label.indexOf(" - ");
                    motif = dash >= 0 ? label.substring(dash + 3) : "";
                }
            }
        }
        return new ExtractedVariables(transport, panier, bonus, indemnite, retenue, motif);
    }
}
