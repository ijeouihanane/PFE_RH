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
public class PayrollProfileDTO {

    private Long employeeId;
    private BigDecimal baseSalary;
    private BigDecimal fixedBonus;
    private boolean active;
}
