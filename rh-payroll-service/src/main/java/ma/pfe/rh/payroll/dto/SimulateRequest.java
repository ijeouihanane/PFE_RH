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
public class SimulateRequest {

    private Long employeeId;
    private int mois;
    private int annee;
    private LocalDate dateEmbauche;
    private List<VariableElementDTO> variables;

    // Tâche 1 — Retenue spécifique manuelle (nullable : si absent/0, aucun impact)
    private BigDecimal retenueSpecifique;
    private String motifRetenue;
}
