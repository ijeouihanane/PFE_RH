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
public class PayslipLineDTO {

    public enum LineType { GAIN, DEDUCTION }

    /** Code technique de la ligne (ex: RETENUE_SPECIFIQUE, CNSS, IR...) */
    private String code;
    private String label;
    private LineType type;
    private BigDecimal base;
    private BigDecimal rate;
    private BigDecimal amount;
    private boolean manual;
}
