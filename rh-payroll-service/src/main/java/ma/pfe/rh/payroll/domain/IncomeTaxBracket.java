package ma.pfe.rh.payroll.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "income_tax_brackets")
public class IncomeTaxBracket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "min_annual_income", nullable = false, precision = 12, scale = 2)
    private BigDecimal minAnnualIncome;

    @Column(name = "max_annual_income", precision = 12, scale = 2)
    private BigDecimal maxAnnualIncome;

    @Column(nullable = false, precision = 6, scale = 2)
    private BigDecimal rate;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal deduction;

    @Column(nullable = false)
    private boolean active;

    @Column(name = "effective_from")
    private LocalDate effectiveFrom;
}
