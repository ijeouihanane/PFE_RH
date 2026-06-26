package ma.pfe.rh.payroll.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchGenerateRowRequest {

    private Long       employeeId;

    // Snapshot employé
    private String     employeeFirstName;
    private String     employeeLastName;
    private String     employeeMatricule;
    private String     employeePoste;
    private String     employeeDepartement;
    private String     employeeCnss;
    private String     employeeRib;
    private String     employeeBankName;
    private LocalDate  employeeHireDate;

    // Variables du mois saisies dans le tableau
    private BigDecimal transport;
    private BigDecimal panier;
    private BigDecimal bonus;
    private BigDecimal indemnite;

    // Retenue spécifique
    private BigDecimal retenueSpecifique;
    private String     motifRetenue;
}
