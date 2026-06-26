package ma.pfe.rh.timesheets.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "timesheet_entries")
public class TimesheetEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "timesheet_id")
    private Timesheet timesheet;

    @Column(name = "date_jour", nullable = false)
    private LocalDate dateJour;

    @Column(name = "nb_heures", nullable = false, precision = 5, scale = 2)
    private BigDecimal nbHeures;

    @Column(length = 2000)
    private String description;

    // ── New fields for calendar grid ──

    @Enumerated(EnumType.STRING)
    @Column(name = "entry_type")
    private EntryType entryType;

    @Enumerated(EnumType.STRING)
    @Column(name = "work_mode")
    private WorkMode workMode;

    @Enumerated(EnumType.STRING)
    @Column(name = "absence_type")
    private AbsenceType absenceType;

    @Column(name = "retard_minutes")
    private Integer retardMinutes;

    @Column(name = "project_id")
    private Long projectId;
}
