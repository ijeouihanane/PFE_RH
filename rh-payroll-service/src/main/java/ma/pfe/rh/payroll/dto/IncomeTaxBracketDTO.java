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
public class IncomeTaxBracketDTO {

    private Long id;
    private BigDecimal minAnnualIncome;
    private BigDecimal maxAnnualIncome;
    private BigDecimal rate;
    private BigDecimal deduction;
}
