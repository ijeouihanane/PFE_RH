package ma.pfe.rh.timesheets.service;

import ma.pfe.rh.timesheets.dto.TimesheetDayInfo;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class TimesheetCalendarService {

    private final JdbcTemplate jdbcTemplate;

    public TimesheetCalendarService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Map<LocalDate, String> holidays(LocalDate monday) {
        LocalDate friday = monday.plusDays(4);
        try {
            return jdbcTemplate.query(
                    """
                    SELECT date_jour, name
                    FROM public_holidays
                    WHERE active = 1 AND date_jour BETWEEN ? AND ?
                    """,
                    rs -> {
                        Map<LocalDate, String> out = new HashMap<>();
                        while (rs.next()) {
                            out.put(rs.getDate("date_jour").toLocalDate(), rs.getString("name"));
                        }
                        return out;
                    },
                    monday,
                    friday
            );
        } catch (Exception e) {
            return Map.of();
        }
    }

    public Map<LocalDate, String> approvedLeaves(long employeeId, LocalDate monday) {
        LocalDate friday = monday.plusDays(4);
        try {
            return jdbcTemplate.query(
                    """
                    SELECT date_debut, date_fin, type_conge
                    FROM leave_requests
                    WHERE employee_id = ?
                      AND statut = 'APPROUVE'
                      AND date_debut <= ?
                      AND date_fin >= ?
                    """,
                    rs -> {
                        Map<LocalDate, String> out = new HashMap<>();
                        while (rs.next()) {
                            LocalDate start = rs.getDate("date_debut").toLocalDate();
                            LocalDate end = rs.getDate("date_fin").toLocalDate();
                            String type = rs.getString("type_conge");
                            for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
                                if (!d.isBefore(monday) && !d.isAfter(friday)) {
                                    out.put(d, type);
                                }
                            }
                        }
                        return out;
                    },
                    employeeId,
                    friday,
                    monday
            );
        } catch (Exception e) {
            return Map.of();
        }
    }

    public List<TimesheetDayInfo> weekDays(long employeeId, LocalDate monday) {
        Map<LocalDate, String> holidays = holidays(monday);
        Map<LocalDate, String> leaves = approvedLeaves(employeeId, monday);
        return java.util.stream.IntStream.range(0, 5)
                .mapToObj(monday::plusDays)
                .map(date -> {
                    boolean weekend = date.getDayOfWeek() == DayOfWeek.SATURDAY || date.getDayOfWeek() == DayOfWeek.SUNDAY;
                    String holiday = holidays.get(date);
                    String leave = leaves.get(date);
                    return TimesheetDayInfo.builder()
                            .date(date)
                            .weekend(weekend)
                            .holidayName(holiday)
                            .leaveType(leave)
                            .workingDay(!weekend && holiday == null && leave == null)
                            .build();
                })
                .toList();
    }

    public int expectedHours(long employeeId, LocalDate monday) {
        return (int) weekDays(employeeId, monday).stream().filter(TimesheetDayInfo::isWorkingDay).count() * 7;
    }
}
