package ma.pfe.rh.documents.service;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import ma.pfe.rh.documents.domain.ContractEntity;
import ma.pfe.rh.documents.domain.ContractType;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Slf4j
@Service
@RequiredArgsConstructor
public class ContractPdfService {

    private final TemplateEngine templateEngine;

    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("dd/MM/yyyy", Locale.FRENCH);

    /**
     * Génère le HTML final du contrat en injectant les données réelles.
     * Ce HTML est sauvegardé comme snapshot immuable (rendered_html).
     */
    public String renderHtml(ContractEntity contract) {
        Context ctx = new Context(Locale.FRENCH);
        populateContext(ctx, contract);
        String templateName = contract.getType() == ContractType.CDI
                ? "contracts/cdi"
                : "contracts/cdd";
        return templateEngine.process(templateName, ctx);
    }

    /**
     * Convertit le HTML rendu en PDF via openhtmltopdf.
     * Même pattern que PayslipPdfService.
     */
    public byte[] htmlToPdf(String html) {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.withHtmlContent(html, null);
            builder.toStream(baos);
            builder.run();
            return baos.toByteArray();
        } catch (Exception e) {
            log.error("Erreur génération PDF contrat", e);
            throw new RuntimeException("Échec de la génération PDF : " + e.getMessage(), e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

    private void populateContext(Context ctx, ContractEntity c) {
        // Données employé (issues du snapshot, pas d'appel distant)
        ctx.setVariable("employeeFullName",    nvl(c.getEmployeeFullName(), "—"));
        ctx.setVariable("employeeMatricule",   nvl(c.getEmployeeMatricule(), "—"));
        ctx.setVariable("employeeCin",         nvl(c.getEmployeeCin(), "—"));
        ctx.setVariable("employeePoste",       nvl(c.getEmployeePoste(), "—"));
        ctx.setVariable("employeeDepartement", nvl(c.getEmployeeDepartement(), "—"));
        ctx.setVariable("employeeEmail",       nvl(c.getEmployeeEmail(), "—"));
        ctx.setVariable("employeeHireDate",    c.getEmployeeHireDate() != null
                ? DATE_FMT.format(c.getEmployeeHireDate()) : "—");

        // Dates contrat
        ctx.setVariable("startDate", c.getStartDate() != null
                ? DATE_FMT.format(c.getStartDate()) : "—");
        ctx.setVariable("endDate", c.getEndDate() != null
                ? DATE_FMT.format(c.getEndDate()) : null);
        ctx.setVariable("signatureDate", c.getSignatureDate() != null
                ? DATE_FMT.format(c.getSignatureDate()) : "—");

        // Champs libres
        ctx.setVariable("workplace",      nvl(c.getWorkplace(), "[lieu de travail]"));
        ctx.setVariable("signaturePlace", nvl(c.getSignaturePlace(), "[lieu de signature]"));
        ctx.setVariable("trialPeriod",    nvl(c.getTrialPeriod(), "[période d'essai]"));
        ctx.setVariable("noticePeriod",   nvl(c.getNoticePeriod(), "[préavis]"));

        // Rémunération — formatage lisible, jamais de variable technique
        ctx.setVariable("baseSalary",  formatMontant(c.getBaseSalary()));
        ctx.setVariable("fixedBonus",  formatMontant(c.getFixedBonus()));

        // Clauses HTML éditées par le RH
        java.util.List<java.util.Map<String, String>> clausesList = new java.util.ArrayList<>();
        if (c.getClausesJson() != null && !c.getClausesJson().isBlank() && !c.getClausesJson().equals("[]")) {
            try {
                com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                clausesList = mapper.readValue(c.getClausesJson(), new com.fasterxml.jackson.core.type.TypeReference<java.util.List<java.util.Map<String, String>>>(){});
            } catch (Exception e) {
                log.error("Erreur lors de la lecture de clausesJson", e);
            }
        }
        ctx.setVariable("clauses", clausesList);

        // Type (utile dans le template pour conditions th:if)
        ctx.setVariable("contractType", c.getType().name());
    }

    private static String nvl(String value, String fallback) {
        return (value == null || value.isBlank()) ? fallback : value;
    }

    private static String formatMontant(BigDecimal amount) {
        if (amount == null) return "[montant à préciser]";
        return String.format(Locale.FRENCH, "%,.2f DH", amount);
    }
}
