package ma.pfe.rh.payroll.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SimulateResponse {

    private List<PayslipLineDTO> lines;

    private BigDecimal grossSalary;
    private BigDecimal totalGains;
    private BigDecimal totalDeductions;
    private BigDecimal cnssAmount;
    private BigDecimal amoAmount;
    private BigDecimal taxableNet;
    private BigDecimal irAmount;
    private BigDecimal netPay;

    // Tâche 1 — Retenue spécifique appliquée (0 si absente)
    private BigDecimal retenueSpecifique;
}
