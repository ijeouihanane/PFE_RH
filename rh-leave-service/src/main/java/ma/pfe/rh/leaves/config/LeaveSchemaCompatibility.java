package ma.pfe.rh.leaves.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class LeaveSchemaCompatibility {

    private static final String EXPECTED_TYPE_CONGE =
            "enum('ANNUEL','MALADIE','MATERNITE','PATERNITE','PATERNITE_NAISSANCE','MARIAGE_SALARIE','MARIAGE_ENFANT','DECES','SANS_SOLDE')";

    private final JdbcTemplate jdbcTemplate;

    @EventListener(ApplicationReadyEvent.class)
    public void ensureLeaveTypeEnumSupportsRefactor() {
        try {
            String columnType = jdbcTemplate.queryForObject("""
                    select column_type
                    from information_schema.columns
                    where table_schema = database()
                      and table_name = 'leave_requests'
                      and column_name = 'type_conge'
                    """, String.class);

            if (columnType == null || columnType.equalsIgnoreCase(EXPECTED_TYPE_CONGE)) {
                return;
            }

            jdbcTemplate.execute("""
                    alter table leave_requests
                    modify column type_conge enum(
                        'ANNUEL',
                        'MALADIE',
                        'MATERNITE',
                        'PATERNITE',
                        'PATERNITE_NAISSANCE',
                        'MARIAGE_SALARIE',
                        'MARIAGE_ENFANT',
                        'DECES',
                        'SANS_SOLDE'
                    ) not null
                    """);
            log.info("leave_requests.type_conge enum upgraded for leave refactor");
        } catch (Exception ex) {
            log.warn("Unable to verify or upgrade leave_requests.type_conge enum", ex);
        }
    }
}
