package ma.pfe.rh.documents.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import ma.pfe.rh.documents.domain.ContractType;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
public class ContractCreateDto {

    @NotNull(message = "Le type de contrat est obligatoire")
    private ContractType type;

    @NotNull(message = "L'identifiant employé est obligatoire")
    private Long employeeId;

    // Snapshot employé fourni par le frontend au moment de la création
    private String employeeFullName;
    private String employeeMatricule;
    private String employeeCin;
    private String employeePoste;
    private String employeeDepartement;
    private String employeeEmail;
    private LocalDate employeeHireDate;

    // Informations contrat
    @NotNull(message = "La date de début est obligatoire")
    private LocalDate startDate;

    /** Obligatoire pour CDD, null pour CDI */
    private LocalDate endDate;

    private String workplace;
    private String signaturePlace;
    private LocalDate signatureDate;
    private String trialPeriod;
    private String noticePeriod;

    // Rémunération
    private BigDecimal baseSalary;
    private BigDecimal fixedBonus;

    // Clauses et données formulaire
    private String formDataJson;

    /** JSON : map articleId → contenu HTML Quill */
    private String clausesJson;
}
