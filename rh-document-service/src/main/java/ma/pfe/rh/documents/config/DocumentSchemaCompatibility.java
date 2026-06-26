package ma.pfe.rh.documents.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DocumentSchemaCompatibility {

    private static final String EXPECTED_TYPE_DOC = "enum('ATTESTATION_TRAVAIL','ATTESTATION_SALAIRE','FICHE_PAIE','ATTESTATION_CNSS','AUTRE','DECLARATION_CNSS','ATTESTATION_STAGE','CERTIFICAT')";

    private final JdbcTemplate jdbcTemplate;

    @EventListener(ApplicationReadyEvent.class)
    public void ensureDocumentRequestEnumCompatibility() {
        try {
            String current = jdbcTemplate.queryForObject("""
                    select column_type
                    from information_schema.columns
                    where table_schema = database()
                      and table_name = 'document_requests'
                      and column_name = 'type_doc'
                    """, String.class);
            if (current != null && !EXPECTED_TYPE_DOC.equalsIgnoreCase(current)) {
                jdbcTemplate.execute("""
                        alter table document_requests
                        modify column type_doc enum('ATTESTATION_TRAVAIL','ATTESTATION_SALAIRE','FICHE_PAIE','ATTESTATION_CNSS','AUTRE','DECLARATION_CNSS','ATTESTATION_STAGE','CERTIFICAT') not null
                        """);
                log.info("document_requests.type_doc enum upgraded for document requests");
            }
        } catch (Exception e) {
            log.warn("Unable to verify document_requests.type_doc enum compatibility: {}", e.getMessage());
        }
    }
}
