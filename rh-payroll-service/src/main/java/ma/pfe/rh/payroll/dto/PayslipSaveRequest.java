package ma.pfe.rh.payroll.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PayslipSaveRequest {

    private Long employeeId;
    private int mois;
    private int annee;

    // Snapshot employé (fourni par le frontend depuis la liste users)
    private String employeeFirstName;
    private String employeeLastName;
    private String employeeMatricule;
    private String employeePoste;
    private String employeeDepartement;
    private String employeeCnss;
    private String employeeRib;
    private String employeeBankName;
    private LocalDate employeeHireDate;

    // Variables RH du mois (ex: prime transport, panier, bonus, indemnité)
    private List<VariableElementDTO> variables;

    // Tâche 1 — Retenue spécifique manuelle (nullable : si absent/0, aucun impact)
    private BigDecimal retenueSpecifique;
    private String motifRetenue;
}
