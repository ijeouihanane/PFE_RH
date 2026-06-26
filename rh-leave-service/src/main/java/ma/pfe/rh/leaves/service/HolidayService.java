package ma.pfe.rh.leaves.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import ma.pfe.rh.leaves.domain.HolidayKind;
import ma.pfe.rh.leaves.domain.HolidaySource;
import ma.pfe.rh.leaves.domain.PublicHoliday;
import ma.pfe.rh.leaves.dto.PublicHolidayDto;
import ma.pfe.rh.leaves.dto.PublicHolidayRequest;
import ma.pfe.rh.leaves.repo.PublicHolidayRepository;
import ma.pfe.rh.leaves.web.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class HolidayService {

    private final PublicHolidayRepository publicHolidayRepository;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${calendarific.api-key:}")
    private String apiKey;

    @Value("${calendarific.country:MA}")
    private String country;

    public record LeaveDayCalculation(int joursCalendaires, int weekendsExclus, int joursFeriesExclus, int joursOuvres) {
    }

    private record RemoteHoliday(LocalDate date, String name) {
    }

    public List<PublicHolidayDto> holidays(int year) {
        ensureYearAvailable(year);
        return publicHolidayRepository.findByYearOrderByDateAsc(year).stream()
                .map(PublicHolidayDto::from)
                .toList();
    }

    public LeaveDayCalculation calculate(LocalDate start, LocalDate end) {
        ensureYearAvailable(start.getYear());
        if (end.getYear() != start.getYear()) {
            ensureYearAvailable(end.getYear());
        }
        List<PublicHoliday> holidays = publicHolidayRepository.findByDateBetweenAndActiveTrue(start, end);
        Set<LocalDate> holidayDates = holidays.stream().map(PublicHoliday::getDate).collect(java.util.stream.Collectors.toSet());
        int calendar = 0;
        int weekends = 0;
        int holidayCount = 0;
        int working = 0;
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            calendar++;
            if (isWeekend(d)) {
                weekends++;
            } else if (holidayDates.contains(d)) {
                holidayCount++;
            } else {
                working++;
            }
        }
        return new LeaveDayCalculation(calendar, weekends, holidayCount, working);
    }

    @Transactional
    public List<PublicHolidayDto> syncCurrentAndNextYears() {
        int current = LocalDate.now().getYear();
        syncYear(current);
        syncYear(current + 1);
        return holidays(current);
    }

    @Transactional
    public PublicHolidayDto createManual(PublicHolidayRequest request) {
        Instant now = Instant.now();
        PublicHoliday holiday = upsert(
                request.getDate(),
                request.getName(),
                request.getKind() == null ? HolidayKind.RELIGIOUS : request.getKind(),
                HolidaySource.MANUAL,
                false,
                request.getActive() == null || request.getActive(),
                now
        );
        return PublicHolidayDto.from(holiday);
    }

    @Transactional
    public PublicHolidayDto updateManualOrReligious(long id, PublicHolidayRequest request) {
        PublicHoliday holiday = publicHolidayRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Jour ferie introuvable"));
        if (holiday.isLocked() || holiday.getKind() == HolidayKind.NATIONAL) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Les jours feries nationaux fixes ne sont pas modifiables");
        }
        holiday.setDate(request.getDate());
        holiday.setYear(request.getDate().getYear());
        holiday.setName(request.getName().trim());
        holiday.setKind(request.getKind() == null ? HolidayKind.RELIGIOUS : request.getKind());
        holiday.setActive(request.getActive() == null || request.getActive());
        holiday.setUpdatedAt(Instant.now());
        return PublicHolidayDto.from(publicHolidayRepository.save(holiday));
    }

    public void ensureCurrentAndNextYearsAvailable() {
        int current = LocalDate.now().getYear();
        ensureYearAvailable(current);
        ensureYearAvailable(current + 1);
    }

    @Scheduled(cron = "0 0 2 1 12 *")
    public void scheduledNextYearSync() {
        syncYear(LocalDate.now().getYear() + 1);
    }

    private void ensureYearAvailable(int year) {
        if (!publicHolidayRepository.existsByYear(year)) {
            syncYear(year);
        }
    }

    private void syncYear(int year) {
        try {
            if (apiKey == null || apiKey.isBlank()) {
                throw new IllegalStateException("Calendarific api key missing");
            }
            String url = UriComponentsBuilder.fromHttpUrl("https://calendarific.com/api/v2/holidays")
                    .queryParam("api_key", apiKey)
                    .queryParam("country", country)
                    .queryParam("year", year)
                    .toUriString();
            String json = restTemplate.getForObject(url, String.class);
            JsonNode holidays = objectMapper.readTree(json).path("response").path("holidays");
            Instant now = Instant.now();
            List<RemoteHoliday> accepted = new ArrayList<>();
            if (holidays.isArray()) {
                for (JsonNode item : holidays) {
                    LocalDate date = LocalDate.parse(item.path("date").path("iso").asText().substring(0, 10));
                    String name = item.path("name").asText("Jour ferie");
                    if (isReligiousHoliday(name, item.path("type"))) {
                        accepted.add(new RemoteHoliday(date, translateReligiousName(name)));
                    } else if (isAcceptedNationalHoliday(date, name, item.path("type"))) {
                        accepted.add(new RemoteHoliday(date, translateNationalName(name)));
                    }
                }
            }
            publicHolidayRepository.deleteByYearAndSource(year, HolidaySource.CALENDARIFIC);
            for (RemoteHoliday holiday : accepted) {
                HolidayKind kind = holiday.date().getMonthValue() == 10 && holiday.date().getDayOfMonth() == 31
                        ? HolidayKind.NATIONAL
                        : HolidayKind.RELIGIOUS;
                upsert(holiday.date(), holiday.name(), kind, HolidaySource.CALENDARIFIC, kind == HolidayKind.NATIONAL, true, now);
            }
            ensureFixedFallback(year);
            ensureKnownReligiousFallback(year);
        } catch (Exception e) {
            ensureFixedFallback(year);
            ensureKnownReligiousFallback(year);
        }
    }

    private void ensureFixedFallback(int year) {
        Instant now = Instant.now();
        upsert(LocalDate.of(year, 1, 1), "Nouvel an", HolidayKind.NATIONAL, HolidaySource.FALLBACK, true, true, now);
        upsert(LocalDate.of(year, 1, 11), "Manifeste de l'independance", HolidayKind.NATIONAL, HolidaySource.FALLBACK, true, true, now);
        upsert(LocalDate.of(year, 1, 14), "Nouvel an amazigh", HolidayKind.NATIONAL, HolidaySource.FALLBACK, true, true, now);
        upsert(LocalDate.of(year, 5, 1), "Fete du travail", HolidayKind.NATIONAL, HolidaySource.FALLBACK, true, true, now);
        upsert(LocalDate.of(year, 7, 30), "Fete du Trone", HolidayKind.NATIONAL, HolidaySource.FALLBACK, true, true, now);
        upsert(LocalDate.of(year, 8, 14), "Recuperation Oued Ed-Dahab", HolidayKind.NATIONAL, HolidaySource.FALLBACK, true, true, now);
        upsert(LocalDate.of(year, 8, 20), "Revolution du Roi et du Peuple", HolidayKind.NATIONAL, HolidaySource.FALLBACK, true, true, now);
        upsert(LocalDate.of(year, 8, 21), "Fete de la Jeunesse", HolidayKind.NATIONAL, HolidaySource.FALLBACK, true, true, now);
        upsert(LocalDate.of(year, 10, 31), "Fete de l'Unite", HolidayKind.NATIONAL, HolidaySource.FALLBACK, true, true, now);
        upsert(LocalDate.of(year, 11, 6), "Marche verte", HolidayKind.NATIONAL, HolidaySource.FALLBACK, true, true, now);
        upsert(LocalDate.of(year, 11, 18), "Fete de l'independance", HolidayKind.NATIONAL, HolidaySource.FALLBACK, true, true, now);
    }

    private void ensureKnownReligiousFallback(int year) {
        if (year != 2026) {
            return;
        }
        Instant now = Instant.now();
        upsert(LocalDate.of(2026, 3, 20), "Aid al-Fitr", HolidayKind.RELIGIOUS, HolidaySource.FALLBACK, false, true, now);
        upsert(LocalDate.of(2026, 5, 27), "Aid al-Adha", HolidayKind.RELIGIOUS, HolidaySource.FALLBACK, false, true, now);
        upsert(LocalDate.of(2026, 6, 17), "1er Moharram", HolidayKind.RELIGIOUS, HolidaySource.FALLBACK, false, true, now);
        upsert(LocalDate.of(2026, 8, 25), "Aid Al Mawlid Annabawi", HolidayKind.RELIGIOUS, HolidaySource.FALLBACK, false, true, now);
    }

    private PublicHoliday upsert(LocalDate date, String name, HolidayKind kind, HolidaySource source, boolean locked, boolean active, Instant now) {
        PublicHoliday holiday = publicHolidayRepository.findByDateAndName(date, name)
                .orElseGet(() -> PublicHoliday.builder()
                        .date(date)
                        .year(date.getYear())
                        .name(name)
                        .createdAt(now)
                        .build());
        holiday.setYear(date.getYear());
        holiday.setKind(kind);
        holiday.setSource(source);
        holiday.setLocked(locked);
        holiday.setActive(active);
        holiday.setUpdatedAt(now);
        return publicHolidayRepository.save(holiday);
    }

    private boolean isReligiousHoliday(String name, JsonNode types) {
        String value = name == null ? "" : name.toLowerCase();
        if (containsAny(value, "eid", "fitr", "adha", "prophet", "muhammad", "mohammed", "mawlid", "mouloud", "muharram", "islamic", "hijri", "hijra", "hegira")) {
            return true;
        }
        if (types.isArray()) {
            for (JsonNode type : types) {
                if (type.asText("").toLowerCase().contains("relig")) {
                    return true;
                }
            }
        }
        return false;
    }

    private boolean isAcceptedNationalHoliday(LocalDate date, String name, JsonNode types) {
        String value = name == null ? "" : name.toLowerCase();
        boolean national = false;
        if (types.isArray()) {
            for (JsonNode type : types) {
                if (type.asText("").toLowerCase().contains("national")) {
                    national = true;
                    break;
                }
            }
        }
        if (!national) {
            return false;
        }
        if (containsAny(value, "equinox", "solstice", "season", "daylight")) {
            return false;
        }
        return date.getMonthValue() == 10 && date.getDayOfMonth() == 31 && containsAny(value, "unity", "wahda", "unite");
    }

    private String translateReligiousName(String name) {
        String value = name == null ? "" : name.toLowerCase();
        if (value.contains("fitr")) {
            return "Aid al-Fitr";
        }
        if (value.contains("adha")) {
            return "Aid al-Adha";
        }
        if (containsAny(value, "prophet", "muhammad", "mohammed", "mawlid", "mouloud")) {
            return "Aid Al Mawlid Annabawi";
        }
        if (containsAny(value, "muharram", "islamic", "hijri", "hijra", "hegira")) {
            return "1er Moharram";
        }
        return name == null || name.isBlank() ? "Jour ferie religieux" : name.trim();
    }

    private String translateNationalName(String name) {
        String value = name == null ? "" : name.toLowerCase();
        if (containsAny(value, "unity", "wahda", "unite")) {
            return "Fete de l'Unite";
        }
        return name == null || name.isBlank() ? "Jour ferie national" : name.trim();
    }

    private boolean containsAny(String value, String... terms) {
        for (String term : terms) {
            if (value.contains(term)) {
                return true;
            }
        }
        return false;
    }

    private static boolean isWeekend(LocalDate date) {
        DayOfWeek day = date.getDayOfWeek();
        return day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY;
    }
}
