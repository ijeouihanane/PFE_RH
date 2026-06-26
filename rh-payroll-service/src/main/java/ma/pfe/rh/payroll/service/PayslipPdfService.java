package ma.pfe.rh.payroll.service;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import ma.pfe.rh.payroll.domain.Payslip;
import ma.pfe.rh.payroll.domain.PayslipLine;
import ma.pfe.rh.payroll.domain.PayslipLineType;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

@Slf4j
@Service
@RequiredArgsConstructor
public class PayslipPdfService {

    private final TemplateEngine templateEngine;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter
            .ofPattern("dd/MM/yyyy", Locale.FRENCH);

    private static final String[] MONTH_NAMES = {
            "", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
            "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    };

    public byte[] generate(Payslip payslip, List<PayslipLine> lines) {
        Context ctx = new Context(Locale.FRENCH);
        ctx.setVariable("payslip", payslip);

        // Période : ex. "Janvier 2025"
        String periode = MONTH_NAMES[payslip.getMois()] + " " + payslip.getAnnee();
        ctx.setVariable("periode", periode);

        // Date de validation
        String dateValidation = payslip.getValidatedAt() != null
                ? DATE_FMT.format(payslip.getValidatedAt().atZone(ZoneId.of("Africa/Casablanca")).toLocalDate())
                : DATE_FMT.format(java.time.LocalDate.now());
        ctx.setVariable("dateValidation", dateValidation);

        // Date embauche
        String hireDateFormatted = payslip.getEmployeeHireDate() != null
                ? DATE_FMT.format(payslip.getEmployeeHireDate())
                : null;
        ctx.setVariable("hireDateFormatted", hireDateFormatted);

        // Lignes GAIN et DEDUCTION séparées
        List<PayslipLine> gainLines = lines.stream()
                .filter(l -> l.getType() == PayslipLineType.GAIN)
                .filter(l -> l.getGainAmount() != null && l.getGainAmount().compareTo(BigDecimal.ZERO) > 0)
                .toList();
        List<PayslipLine> deductionLines = lines.stream()
                .filter(l -> l.getType() == PayslipLineType.DEDUCTION)
                .filter(l -> l.getDeductionAmount() != null && l.getDeductionAmount().compareTo(BigDecimal.ZERO) > 0)
                .toList();
        ctx.setVariable("gainLines", gainLines);
        ctx.setVariable("deductionLines", deductionLines);

        // Totaux
        BigDecimal totalGains = gainLines.stream()
                .map(PayslipLine::getGainAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalDeductions = deductionLines.stream()
                .map(PayslipLine::getDeductionAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        ctx.setVariable("totalGains", totalGains);
        ctx.setVariable("totalDeductions", totalDeductions);

        // Rendu HTML
        String html = templateEngine.process("payslip-template", ctx);

        // Conversion HTML → PDF
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.withHtmlContent(html, null);
            builder.toStream(baos);
            builder.run();
            return baos.toByteArray();
        } catch (Exception e) {
            log.error("Erreur génération PDF pour bulletin #{}", payslip.getId(), e);
            throw new RuntimeException("Échec de la génération PDF : " + e.getMessage(), e);
        }
    }
}
