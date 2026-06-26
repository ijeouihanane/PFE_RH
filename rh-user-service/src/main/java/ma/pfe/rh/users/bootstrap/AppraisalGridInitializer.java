package ma.pfe.rh.users.bootstrap;

import lombok.RequiredArgsConstructor;
import ma.pfe.rh.users.domain.AppraisalCriterion;
import ma.pfe.rh.users.domain.AppraisalGridTemplate;
import ma.pfe.rh.users.repo.AppraisalCriterionRepository;
import ma.pfe.rh.users.repo.AppraisalGridTemplateRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Component
@RequiredArgsConstructor
public class AppraisalGridInitializer implements CommandLineRunner {

    private final AppraisalGridTemplateRepository gridRepository;
    private final AppraisalCriterionRepository criterionRepository;

    @Override
    @Transactional
    public void run(String... args) {
        seed(
                "IT_TECHNIQUE",
                "Technique / IT",
                "IT",
                List.of(
                        criterion("Qualité du code et des livrables", "Fiabilité, lisibilité, maintenabilité du code et qualité des travaux livrés.", 1),
                        criterion("Résolution de problèmes", "Capacité à analyser les incidents, proposer des solutions et agir avec méthode.", 2),
                        criterion("Respect des délais", "Capacité à livrer dans les délais convenus et à signaler les risques à temps.", 3),
                        criterion("Collaboration technique", "Partage d’information, documentation et coopération avec l’équipe.", 4)
                )
        );
        seed(
                "MARKETING",
                "Marketing",
                "Marketing",
                List.of(
                        criterion("Créativité et proposition d’idées", "Capacité à proposer des idées pertinentes et adaptées aux objectifs marketing.", 1),
                        criterion("Qualité des campagnes", "Soin apporté à la préparation, l’exécution et le suivi des actions marketing.", 2),
                        criterion("Analyse des résultats", "Capacité à lire les indicateurs, tirer des conclusions et proposer des améliorations.", 3),
                        criterion("Coordination et communication", "Qualité des échanges avec les équipes internes, prestataires ou partenaires.", 4)
                )
        );
        seed(
                "GENERIC",
                "Grille générique",
                null,
                List.of(
                        criterion("Qualité du travail", "Fiabilité, précision et soin dans les tâches confiées.", 1),
                        criterion("Respect des engagements", "Respect des délais, des consignes et des responsabilités du poste.", 2),
                        criterion("Communication professionnelle", "Clarté, réactivité et qualité des échanges avec l’équipe et la hiérarchie.", 3),
                        criterion("Autonomie et initiative", "Capacité à avancer avec autonomie et à proposer des solutions adaptées.", 4)
                )
        );
        backfillVersionMetadata();
    }

    private void seed(String code, String label, String department, List<CriterionSeed> criteria) {
        AppraisalGridTemplate grid = gridRepository.findByCode(code)
                .orElseGet(() -> {
                    Instant now = Instant.now();
                    return gridRepository.save(AppraisalGridTemplate.builder()
                            .code(code)
                            .label(label)
                            .department(department)
                            .active(true)
                            .versionNumber(1)
                            .publishedAt(now)
                            .updatedAt(now)
                            .createdAt(now)
                            .build());
                });

        if (criterionRepository.countByGridTemplateId(grid.getId()) > 0) {
            return;
        }
        criterionRepository.saveAll(criteria.stream()
                .map(seed -> AppraisalCriterion.builder()
                        .gridTemplate(grid)
                        .label(seed.label())
                        .description(seed.description())
                        .displayOrder(seed.order())
                        .active(true)
                        .build())
                .toList());
    }

    private void backfillVersionMetadata() {
        for (AppraisalGridTemplate grid : gridRepository.findAll()) {
            boolean changed = false;
            if (grid.getVersionNumber() == null) {
                grid.setVersionNumber(1);
                changed = true;
            }
            if (grid.getPublishedAt() == null) {
                grid.setPublishedAt(grid.getCreatedAt());
                changed = true;
            }
            if (grid.getUpdatedAt() == null) {
                grid.setUpdatedAt(grid.getPublishedAt());
                changed = true;
            }
            if (changed) {
                gridRepository.save(grid);
            }
        }
    }

    private static CriterionSeed criterion(String label, String description, int order) {
        return new CriterionSeed(label, description, order);
    }

    private record CriterionSeed(String label, String description, int order) {
    }
}
