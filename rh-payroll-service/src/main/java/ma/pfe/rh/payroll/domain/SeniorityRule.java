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

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "seniority_rules")
public class SeniorityRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "min_years", nullable = false)
    private int minYears;

    @Column(name = "max_years")
    private Integer maxYears;

    @Column(nullable = false, precision = 6, scale = 2)
    private BigDecimal rate;

    @Column(nullable = false)
    private boolean active;
}
