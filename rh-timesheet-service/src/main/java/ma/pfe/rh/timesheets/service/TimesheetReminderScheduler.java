package ma.pfe.rh.timesheets.service;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalDate;

@Component
@RequiredArgsConstructor
public class TimesheetReminderScheduler {

    private final TimesheetService timesheetService;

    @Scheduled(cron = "0 0 16 * * FRI", zone = "Africa/Casablanca")
    public void remindMissingFridayAfternoon() {
        LocalDate monday = LocalDate.now().with(DayOfWeek.MONDAY);
        timesheetService.remindMissingAutomatically(monday);
    }
}
