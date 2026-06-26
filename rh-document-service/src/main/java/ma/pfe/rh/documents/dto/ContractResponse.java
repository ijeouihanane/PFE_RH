package ma.pfe.rh.documents.dto;

import lombok.Builder;
import lombok.Getter;
import ma.pfe.rh.documents.domain.ContractEntity;
import ma.pfe.rh.documents.domain.ContractStatus;
import ma.pfe.rh.documents.domain.ContractType;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Getter
@Builder
public class ContractResponse {

    private Long id;

    // Employé
    private Long employeeId;
    private String employeeFullName;
    private String employeeMatricule;
    private String employeeCin;
    private String employeePoste;
    private String employeeDepartement;
    private String employeeEmail;
    private LocalDate employeeHireDate;

    // Contrat
    private ContractType type;
    private ContractStatus status;
    private LocalDate startDate;
    private LocalDate endDate;
    private String workplace;
    private String signaturePlace;
    private LocalDate signatureDate;
    private String trialPeriod;
    private String noticePeriod;

    // Rémunération
    private BigDecimal baseSalary;
    private BigDecimal fixedBonus;

    // Clauses et données
    private String formDataJson;
    private String clausesJson;

    /**
     * Snapshot HTML du contrat tel qu'il était au moment de la génération.
     * Utilisé par le bouton "Voir" pour les contrats GENERE.
     */
    private String renderedHtml;
    private String pdfUrl;

    // Audit
    private Long createdBy;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant generatedAt;

    public static ContractResponse from(ContractEntity e) {
        return ContractResponse.builder()
                .id(e.getId())
                .employeeId(e.getEmployeeId())
                .employeeFullName(e.getEmployeeFullName())
                .employeeMatricule(e.getEmployeeMatricule())
                .employeeCin(e.getEmployeeCin())
                .employeePoste(e.getEmployeePoste())
                .employeeDepartement(e.getEmployeeDepartement())
                .employeeEmail(e.getEmployeeEmail())
                .employeeHireDate(e.getEmployeeHireDate())
                .type(e.getType())
                .status(e.getStatus())
                .startDate(e.getStartDate())
                .endDate(e.getEndDate())
                .workplace(e.getWorkplace())
                .signaturePlace(e.getSignaturePlace())
                .signatureDate(e.getSignatureDate())
                .trialPeriod(e.getTrialPeriod())
                .noticePeriod(e.getNoticePeriod())
                .baseSalary(e.getBaseSalary())
                .fixedBonus(e.getFixedBonus())
                .formDataJson(e.getFormDataJson())
                .clausesJson(e.getClausesJson())
                .renderedHtml(e.getRenderedHtml())
                .pdfUrl(e.getPdfUrl())
                .createdBy(e.getCreatedBy())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .generatedAt(e.getGeneratedAt())
                .build();
    }
}
