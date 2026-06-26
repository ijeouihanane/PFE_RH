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
public class SeniorityRuleDTO {

    private Long id;
    private int minYears;
    private Integer maxYears;
    private BigDecimal rate;
}
