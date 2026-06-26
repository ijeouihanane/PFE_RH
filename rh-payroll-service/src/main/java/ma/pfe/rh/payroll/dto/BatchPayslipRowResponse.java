package ma.pfe.rh.payroll.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchPayslipRowResponse {

    private Long   employeeId;

    // Profil paie
    private boolean hasProfile;
    private BigDecimal baseSalary;
    private BigDecimal fixedBonus;

    // Variables calculées (depuis DRAFT ou simulation à 0)
    private BigDecimal transport;
    private BigDecimal panier;
    private BigDecimal bonus;
    private BigDecimal indemnite;
    private BigDecimal retenueSpecifique;
    private String     motifRetenue;

    // Résultat du calcul
    private BigDecimal netPay;

    // Statut bulletin existant (null = aucun, DRAFT, VALIDATED, SENT)
    private String status;
    private String pdfUrl;

    // Générable = profil présent + pas déjà VALIDATED/SENT
    private boolean generable;

    // Message d'erreur technique si le calcul a échoué
    private String error;
}
