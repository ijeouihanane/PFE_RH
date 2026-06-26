package ma.pfe.rh.documents.dto;

import lombok.Getter;
import lombok.Setter;
import ma.pfe.rh.documents.domain.ContractType;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * DTO de mise à jour : tous les champs sont optionnels.
 * Seul un contrat au statut BROUILLON peut être modifié.
 */
@Getter
@Setter
public class ContractUpdateDto {

    private ContractType type;

    // Snapshot employé (peut être mis à jour si changement d'employé)
    private Long employeeId;
    private String employeeFullName;
    private String employeeMatricule;
    private String employeeCin;
    private String employeePoste;
    private String employeeDepartement;
    private String employeeEmail;
    private LocalDate employeeHireDate;

    // Informations contrat
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

    // Clauses
    private String formDataJson;
    private String clausesJson;
}
