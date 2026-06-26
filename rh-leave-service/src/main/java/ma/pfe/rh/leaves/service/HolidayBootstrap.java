package ma.pfe.rh.leaves.service;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class HolidayBootstrap implements ApplicationRunner {

    private final HolidayService holidayService;

    @Override
    public void run(ApplicationArguments args) {
        holidayService.ensureCurrentAndNextYearsAvailable();
    }
}
