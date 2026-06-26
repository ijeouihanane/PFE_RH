package ma.pfe.rh.payroll.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchPayslipRowRequest {

    private Long   employeeId;
    private String employeeFirstName;
    private String employeeLastName;
    private String employeeMatricule;
    private String employeePoste;
    private String employeeDepartement;
    private String employeeCnss;
    private String employeeRib;
    private String employeeBankName;
    private LocalDate employeeHireDate;

    /** Variables RH saisies dans la ligne du tableau (transport, panier, bonus, indemnité). */
    private List<VariableElementDTO> variables;

    /** Retenue spécifique (null ou 0 = aucune retenue). */
    private BigDecimal retenueSpecifique;
    private String     motifRetenue;

    private boolean recalculation;
}
