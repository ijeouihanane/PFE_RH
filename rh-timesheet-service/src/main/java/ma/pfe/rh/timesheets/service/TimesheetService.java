package ma.pfe.rh.timesheets.service;

import lombok.RequiredArgsConstructor;
import ma.pfe.rh.timesheets.domain.EntryType;
import ma.pfe.rh.timesheets.domain.Timesheet;
import ma.pfe.rh.timesheets.domain.TimesheetDeliverable;
import ma.pfe.rh.timesheets.domain.TimesheetEntry;
import ma.pfe.rh.timesheets.domain.TimesheetEvent;
import ma.pfe.rh.timesheets.domain.TimesheetStatus;
import ma.pfe.rh.timesheets.domain.WorkMode;
import ma.pfe.rh.timesheets.dto.TimesheetDayInfo;
import ma.pfe.rh.timesheets.dto.TimesheetDeliverableRequest;
import ma.pfe.rh.timesheets.dto.TimesheetDraftRequest;
import ma.pfe.rh.timesheets.dto.TimesheetEntryRequest;
import ma.pfe.rh.timesheets.dto.TimesheetEntryResponse;
import ma.pfe.rh.timesheets.dto.TimesheetResponse;
import ma.pfe.rh.timesheets.integration.OrgDirectory;
import ma.pfe.rh.timesheets.kafka.TimesheetKafkaProducer;
import ma.pfe.rh.timesheets.repo.TimesheetRepository;
import ma.pfe.rh.timesheets.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TimesheetService {

    private static final BigDecimal DAILY_HOURS = new BigDecimal("7.0");

    private final TimesheetRepository timesheetRepository;
    private final OrgDirectory orgDirectory;
    private final TimesheetKafkaProducer kafkaProducer;
    private final TimesheetCalendarService calendarService;
    private final ProjectService projectService;

    @Transactional(readOnly = true)
    public TimesheetResponse currentWeek(long employeeId) {
        return getWeek(employeeId, LocalDate.now().with(DayOfWeek.MONDAY));
    }

    @Transactional(readOnly = true)
    public TimesheetResponse getWeek(long employeeId, LocalDate monday) {
        Timesheet ts = timesheetRepository.findByEmployeeIdAndSemaineDebut(employeeId, monday)
                .orElseGet(() -> newDraft(employeeId, monday));
        return toResponse(ts);
    }

    @Transactional(readOnly = true)
    public List<TimesheetResponse> history(long employeeId) {
        return timesheetRepository.findByEmployeeIdOrderBySemaineDebutDesc(employeeId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public TimesheetResponse addEntry(long employeeId, String role, long timesheetId, TimesheetEntryRequest req) {
        assertNotFutureWeek(req.getDateJour().with(DayOfWeek.MONDAY));
        Timesheet ts = timesheetId == 0
                ? timesheetRepository.findByEmployeeIdAndSemaineDebut(employeeId, req.getDateJour().with(DayOfWeek.MONDAY))
                        .orElseGet(() -> timesheetRepository.save(newDraft(employeeId, req.getDateJour().with(DayOfWeek.MONDAY))))
                : loadOwned(employeeId, timesheetId);

        if (ts.getStatut() != TimesheetStatus.BROUILLON) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Feuille non modifiable");
        }
        assertDateInWeek(ts.getSemaineDebut(), req.getDateJour());
        assertEditableWorkingDay(employeeId, ts.getSemaineDebut(), req.getDateJour());

        EntryType type = EntryType.valueOf(req.getEntryType());
        if (type != EntryType.PROJET) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Seules les saisies projet sont autorisees dans cette version");
        }

        BigDecimal nb = req.getNbHeures() != null ? req.getNbHeures() : BigDecimal.ZERO;
        if (nb.compareTo(BigDecimal.ZERO) <= 0 || nb.compareTo(DAILY_HOURS) > 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Heures invalides (max 7h/jour)");
        }
        if (trimToNull(req.getDescription()) == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La description des taches est obligatoire");
        }
        if (!projectService.canUseProject(employeeId, role, req.getProjectId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Projet indisponible pour cette feuille de temps");
        }

        ts.getEntries().removeIf(e -> e.getDateJour().equals(req.getDateJour()) && e.getEntryType() == EntryType.PROJET);
        ts.getEntries().add(TimesheetEntry.builder()
                .timesheet(ts)
                .dateJour(req.getDateJour())
                .entryType(type)
                .workMode(req.getWorkMode() != null ? WorkMode.valueOf(req.getWorkMode()) : null)
                .projectId(req.getProjectId())
                .nbHeures(nb)
                .description(trimToNull(req.getDescription()))
                .build());
        return toResponse(timesheetRepository.save(ts));
    }

    @Transactional
    public TimesheetResponse deleteEntry(long employeeId, long timesheetId, long entryId) {
        Timesheet ts = loadOwned(employeeId, timesheetId);
        if (ts.getStatut() != TimesheetStatus.BROUILLON) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Feuille non modifiable");
        }
        ts.getEntries().removeIf(e -> e.getId().equals(entryId));
        return toResponse(timesheetRepository.save(ts));
    }

    @Transactional
    public TimesheetResponse saveDraft(long employeeId, LocalDate monday, TimesheetDraftRequest req) {
        assertNotFutureWeek(monday);
        Timesheet ts = timesheetRepository.findByEmployeeIdAndSemaineDebut(employeeId, monday)
                .orElseGet(() -> timesheetRepository.save(newDraft(employeeId, monday)));
        if (ts.getStatut() != TimesheetStatus.BROUILLON) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Feuille non modifiable");
        }
        applyDraft(ts, req);
        return toResponse(timesheetRepository.save(ts));
    }

    @Transactional
    public TimesheetResponse reopenAfterReject(long employeeId, long timesheetId) {
        Timesheet ts = loadOwned(employeeId, timesheetId);
        if (ts.getStatut() != TimesheetStatus.REJETE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Seules les feuilles refusees peuvent etre rouvertes");
        }
        ts.setStatut(TimesheetStatus.BROUILLON);
        ts.setCommentaireManager(null);
        ts.setRejectedAt(null);
        ts.setRejectedBy(null);
        addEvent(ts, "Brouillon repris", employeeId, null);
        return toResponse(timesheetRepository.save(ts));
    }

    @Transactional
    public TimesheetResponse submit(long employeeId, long timesheetId) {
        Timesheet ts = loadOwned(employeeId, timesheetId);
        if (ts.getStatut() != TimesheetStatus.BROUILLON) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Feuille deja soumise");
        }
        assertNotFutureWeek(ts.getSemaineDebut());
        validateReadyToSubmit(ts);
        ts.setStatut(TimesheetStatus.SOUMIS);
        ts.setSubmittedAt(Instant.now());
        addEvent(ts, "Soumise", employeeId, null);
        Timesheet saved = timesheetRepository.save(ts);

        Long validatorId = orgDirectory.findManagerId(employeeId);
        if (validatorId != null) {
            Map<String, Object> payload = eventPayload(saved, employeeId);
            payload.put("recipientId", validatorId);
            kafkaProducer.safePublish(TimesheetKafkaProducer.TOPIC_SUBMITTED, payload);
        } else {
            notifyRh(saved, TimesheetKafkaProducer.TOPIC_SUBMITTED);
        }
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public TimesheetResponse getById(long id) {
        return timesheetRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Feuille introuvable"));
    }

    @Transactional
    public TimesheetResponse approve(long timesheetId, long actorId) {
        Timesheet ts = timesheetRepository.findById(timesheetId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Feuille introuvable"));
        if (ts.getStatut() != TimesheetStatus.SOUMIS) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Seules les feuilles soumises peuvent etre validees");
        }
        ts.setStatut(TimesheetStatus.VALIDE);
        ts.setValidatedAt(Instant.now());
        ts.setValidatedBy(actorId);
        addEvent(ts, "Validee", actorId, null);
        Timesheet saved = timesheetRepository.save(ts);
        kafkaProducer.safePublish(TimesheetKafkaProducer.TOPIC_APPROVED, eventPayload(saved, actorId));
        return toResponse(saved);
    }

    @Transactional
    public TimesheetResponse reject(long timesheetId, long actorId, String comment) {
        Timesheet ts = timesheetRepository.findById(timesheetId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Feuille introuvable"));
        if (ts.getStatut() != TimesheetStatus.SOUMIS) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Seules les feuilles soumises peuvent etre refusees");
        }
        ts.setStatut(TimesheetStatus.REJETE);
        ts.setCommentaireManager(comment);
        ts.setRejectedAt(Instant.now());
        ts.setRejectedBy(actorId);
        addEvent(ts, "Refusee", actorId, comment);
        Timesheet saved = timesheetRepository.save(ts);
        kafkaProducer.safePublish(TimesheetKafkaProducer.TOPIC_REJECTED, eventPayload(saved, actorId));
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<TimesheetResponse> managerTeam(long managerId) {
        List<Long> team = orgDirectory.teamMemberIds(managerId);
        if (team.isEmpty()) {
            return List.of();
        }
        return timesheetRepository.findByEmployeeIdInAndStatutInOrderBySemaineDebutDesc(
                team,
                List.of(TimesheetStatus.SOUMIS, TimesheetStatus.VALIDE, TimesheetStatus.REJETE)
        ).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<TimesheetResponse> rhAll() {
        return timesheetRepository.findAll().stream()
                .filter(t -> t.getStatut() != TimesheetStatus.BROUILLON)
                .sorted((a, b) -> b.getSemaineDebut().compareTo(a.getSemaineDebut()))
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public int remindMissingForManager(long managerId, LocalDate monday) {
        int count = 0;
        for (Long employeeId : orgDirectory.teamMemberIds(managerId)) {
            if (missingSubmission(employeeId, monday)) {
                count++;
                Map<String, Object> payload = new HashMap<>();
                payload.put("recipientId", employeeId);
                payload.put("managerId", managerId);
                payload.put("week", monday.toString());
                kafkaProducer.safePublish(TimesheetKafkaProducer.TOPIC_REMINDER, payload);
            }
        }
        return count;
    }

    @Transactional
    public int remindMissingAutomatically(LocalDate monday) {
        int count = 0;
        for (Long employeeId : orgDirectory.activeEmployeeAndManagerIds()) {
            if (!missingSubmission(employeeId, monday)) {
                continue;
            }
            Long managerId = orgDirectory.findManagerId(employeeId);
            if (managerId != null) {
                Map<String, Object> payload = new HashMap<>();
                payload.put("recipientId", managerId);
                payload.put("employeeId", employeeId);
                payload.put("week", monday.toString());
                kafkaProducer.safePublish(TimesheetKafkaProducer.TOPIC_REMINDER, payload);
                count++;
            } else {
                for (Long rhId : orgDirectory.activeRhIds()) {
                    Map<String, Object> payload = new HashMap<>();
                    payload.put("recipientId", rhId);
                    payload.put("employeeId", employeeId);
                    payload.put("week", monday.toString());
                    kafkaProducer.safePublish(TimesheetKafkaProducer.TOPIC_REMINDER, payload);
                    count++;
                }
            }
        }
        return count;
    }

    public TimesheetResponse toResponse(Timesheet t) {
        Long managerId = orgDirectory.findManagerId(t.getEmployeeId());
        List<TimesheetDayInfo> days = calendarService.weekDays(t.getEmployeeId(), t.getSemaineDebut());
        OrgDirectory.UserSummary employee = orgDirectory.findUser(t.getEmployeeId()).orElse(null);
        OrgDirectory.UserSummary manager = managerId != null ? orgDirectory.findUser(managerId).orElse(null) : null;
        TimesheetResponse res = TimesheetResponse.from(t, managerId).toBuilder()
                .employeeName(employee != null && !employee.fullName().isBlank() ? employee.fullName() : null)
                .employeeMatricule(employee != null ? employee.matricule() : null)
                .employeeDepartment(employee != null ? employee.department() : null)
                .managerName(manager != null && !manager.fullName().isBlank() ? manager.fullName() : null)
                .entries(t.getEntries() != null
                        ? t.getEntries().stream()
                                .map(e -> TimesheetEntryResponse.from(e, projectService.projectName(e.getProjectId())))
                                .toList()
                        : List.of())
                .validatorId(managerId)
                .validatorName(manager != null && !manager.fullName().isBlank() ? manager.fullName() : null)
                .expectedHours(calendarService.expectedHours(t.getEmployeeId(), t.getSemaineDebut()))
                .holidayDays((int) days.stream().filter(d -> d.getHolidayName() != null).count())
                .leaveDays((int) days.stream().filter(d -> d.getLeaveType() != null).count())
                .days(days)
                .build();
        calendarService.holidays(t.getSemaineDebut()).forEach((date, name) -> res.getHolidays().put(date.toString(), name));
        return res;
    }

    private Timesheet newDraft(long employeeId, LocalDate monday) {
        return Timesheet.builder()
                .employeeId(employeeId)
                .semaineDebut(monday)
                .statut(TimesheetStatus.BROUILLON)
                .entries(new java.util.ArrayList<>())
                .deliverables(new java.util.ArrayList<>())
                .events(new java.util.ArrayList<>())
                .build();
    }

    private Timesheet loadOwned(long employeeId, long timesheetId) {
        Timesheet ts = timesheetRepository.findById(timesheetId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Feuille introuvable"));
        if (!ts.getEmployeeId().equals(employeeId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Acces refuse");
        }
        return ts;
    }

    private void assertDateInWeek(LocalDate weekMonday, LocalDate day) {
        if (day.isBefore(weekMonday) || day.isAfter(weekMonday.plusDays(6))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La date doit etre dans la semaine");
        }
    }

    private void assertEditableWorkingDay(long employeeId, LocalDate monday, LocalDate day) {
        TimesheetDayInfo info = calendarService.weekDays(employeeId, monday).stream()
                .filter(d -> d.getDate().equals(day))
                .findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Jour invalide"));
        if (!info.isWorkingDay()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Saisie impossible sur conge valide ou jour ferie");
        }
    }

    private void validateReadyToSubmit(Timesheet ts) {
        if (trimToNull(ts.getFaitsMarquants()) == null || trimToNull(ts.getRisquesBlocages()) == null || trimToNull(ts.getPlanSemaineProchaine()) == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Les 3 sections du rapport hebdomadaire sont obligatoires");
        }
        int workingDays = 0;
        for (TimesheetDayInfo day : calendarService.weekDays(ts.getEmployeeId(), ts.getSemaineDebut())) {
            if (!day.isWorkingDay()) {
                continue;
            }
            workingDays++;
            BigDecimal total = ts.getEntries().stream()
                    .filter(e -> e.getDateJour().equals(day.getDate()) && e.getEntryType() == EntryType.PROJET)
                    .map(e -> e.getNbHeures() != null ? e.getNbHeures() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            if (total.compareTo(DAILY_HOURS) != 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Chaque jour ouvrable doit contenir exactement 7h avant soumission");
            }
        }
        if (workingDays == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Soumission impossible: aucun jour ouvrable a saisir sur cette semaine");
        }
    }

    private void assertNotFutureWeek(LocalDate monday) {
        LocalDate currentMonday = LocalDate.now().with(DayOfWeek.MONDAY);
        if (monday.isAfter(currentMonday)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La saisie d'une semaine future n'est pas autorisee");
        }
    }

    private void applyDraft(Timesheet ts, TimesheetDraftRequest req) {
        ts.setFaitsMarquants(trimToNull(req.getFaitsMarquants()));
        ts.setRisquesBlocages(trimToNull(req.getRisquesBlocages()));
        ts.setPlanSemaineProchaine(trimToNull(req.getPlanSemaineProchaine()));
        ts.setSuggestionsAmeliorations(trimToNull(req.getSuggestionsAmeliorations()));
        ts.getDeliverables().clear();
        if (req.getDeliverables() != null) {
            for (TimesheetDeliverableRequest d : req.getDeliverables()) {
                String label = trimToNull(d.getLabel());
                String url = trimToNull(d.getUrl());
                if (label != null && url != null) {
                    ts.getDeliverables().add(TimesheetDeliverable.builder()
                            .timesheet(ts)
                            .label(label)
                            .url(url)
                            .createdAt(Instant.now())
                            .build());
                }
            }
        }
    }

    private void addEvent(Timesheet ts, String action, Long actorId, String comment) {
        ts.getEvents().add(TimesheetEvent.builder()
                .timesheet(ts)
                .action(action)
                .actorId(actorId)
                .comment(trimToNull(comment))
                .createdAt(Instant.now())
                .build());
    }

    private boolean missingSubmission(long employeeId, LocalDate monday) {
        return timesheetRepository.findByEmployeeIdAndSemaineDebut(employeeId, monday)
                .map(t -> t.getStatut() == TimesheetStatus.BROUILLON)
                .orElse(true);
    }

    private void notifyRh(Timesheet ts, String topic) {
        for (Long rhId : orgDirectory.activeRhIds()) {
            Map<String, Object> payload = eventPayload(ts, ts.getEmployeeId());
            payload.put("recipientId", rhId);
            kafkaProducer.safePublish(topic, payload);
        }
    }

    private Map<String, Object> eventPayload(Timesheet ts, long actorId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("timesheetId", ts.getId());
        payload.put("employeeId", ts.getEmployeeId());
        payload.put("actorId", actorId);
        payload.put("week", ts.getSemaineDebut().toString());
        return payload;
    }

    private static String trimToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
