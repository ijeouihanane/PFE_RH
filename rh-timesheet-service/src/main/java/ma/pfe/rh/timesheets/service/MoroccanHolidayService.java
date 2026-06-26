package ma.pfe.rh.timesheets.service;

import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.MonthDay;
import java.util.HashMap;
import java.util.Map;

@Service
public class MoroccanHolidayService {

    private static final Map<MonthDay, String> FIXED_HOLIDAYS = new HashMap<>();

    static {
        FIXED_HOLIDAYS.put(MonthDay.of(1, 1), "Nouvel An");
        FIXED_HOLIDAYS.put(MonthDay.of(1, 11), "Manifeste de l'Indépendance");
        FIXED_HOLIDAYS.put(MonthDay.of(1, 14), "Nouvel An Amazigh");
        FIXED_HOLIDAYS.put(MonthDay.of(5, 1), "Fête du Travail");
        FIXED_HOLIDAYS.put(MonthDay.of(7, 30), "Fête du Trône");
        FIXED_HOLIDAYS.put(MonthDay.of(8, 14), "Récupération Oued Eddahab");
        FIXED_HOLIDAYS.put(MonthDay.of(8, 20), "Révolution du Roi et du Peuple");
        FIXED_HOLIDAYS.put(MonthDay.of(8, 21), "Fête de la Jeunesse");
        FIXED_HOLIDAYS.put(MonthDay.of(11, 6), "Marche Verte");
        FIXED_HOLIDAYS.put(MonthDay.of(11, 18), "Fête de l'Indépendance");
    }

    public boolean isHoliday(LocalDate date) {
        return FIXED_HOLIDAYS.containsKey(MonthDay.from(date));
    }

    public String getHolidayName(LocalDate date) {
        return FIXED_HOLIDAYS.get(MonthDay.from(date));
    }

    public Map<String, String> getHolidaysForWeek(LocalDate monday) {
        Map<String, String> weekHolidays = new HashMap<>();
        for (int i = 0; i < 7; i++) {
            LocalDate current = monday.plusDays(i);
            if (isHoliday(current)) {
                weekHolidays.put(current.toString(), getHolidayName(current));
            }
        }
        return weekHolidays;
    }
}
