package ma.pfe.rh.payroll.dto;

import lombok.Builder;
import lombok.Value;
import ma.pfe.rh.payroll.domain.Payslip;
import ma.pfe.rh.payroll.domain.PayslipStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Value
@Builder
public class PayslipResponse {

    Long id;
    Long employeeId;
    int mois;
    int annee;

    // Compatibilité ancien upload PDF
    String fichierUrl;
    Long uploadedBy;
    Instant createdAt;

    // Lot 3
    PayslipStatus status;
    BigDecimal baseSalary;
    BigDecimal fixedBonus;
    BigDecimal seniorityBonus;
    BigDecimal grossSalary;
    BigDecimal cnssAmount;
    BigDecimal amoAmount;
    BigDecimal taxableNet;
    BigDecimal irAmount;
    BigDecimal netPay;
    String pdfUrl;
    Long validatedBy;
    Instant validatedAt;
    Instant sentAt;
    Instant updatedAt;

    // Snapshot employé
    String employeeFirstName;
    String employeeLastName;
    String employeeMatricule;
    String employeePoste;
    String employeeDepartement;
    String employeeCnss;
    String employeeRib;
    String employeeBankName;
    LocalDate employeeHireDate;

    // Lignes du bulletin
    List<PayslipLineDTO> lines;

    public static PayslipResponse from(Payslip p) {
        return from(p, null);
    }

    public static PayslipResponse from(Payslip p, List<PayslipLineDTO> lines) {
        return PayslipResponse.builder()
                .id(p.getId())
                .employeeId(p.getEmployeeId())
                .mois(p.getMois())
                .annee(p.getAnnee())
                .fichierUrl(p.getFichierUrl())
                .uploadedBy(p.getUploadedBy())
                .createdAt(p.getCreatedAt())
                .status(p.getStatus())
                .baseSalary(p.getBaseSalary())
                .fixedBonus(p.getFixedBonus())
                .seniorityBonus(p.getSeniorityBonus())
                .grossSalary(p.getGrossSalary())
                .cnssAmount(p.getCnssAmount())
                .amoAmount(p.getAmoAmount())
                .taxableNet(p.getTaxableNet())
                .irAmount(p.getIrAmount())
                .netPay(p.getNetPay())
                .pdfUrl(p.getPdfUrl())
                .validatedBy(p.getValidatedBy())
                .validatedAt(p.getValidatedAt())
                .sentAt(p.getSentAt())
                .updatedAt(p.getUpdatedAt())
                .employeeFirstName(p.getEmployeeFirstName())
                .employeeLastName(p.getEmployeeLastName())
                .employeeMatricule(p.getEmployeeMatricule())
                .employeePoste(p.getEmployeePoste())
                .employeeDepartement(p.getEmployeeDepartement())
                .employeeCnss(p.getEmployeeCnss())
                .employeeRib(p.getEmployeeRib())
                .employeeBankName(p.getEmployeeBankName())
                .employeeHireDate(p.getEmployeeHireDate())
                .lines(lines)
                .build();
    }
}
