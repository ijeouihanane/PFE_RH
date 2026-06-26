package ma.pfe.rh.users.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class AdminDashboardSummaryResponse {
    int totalComptes;
    int comptesActifs;
    int comptesEnAttente;
    int comptesDesactives;
    int sansManager;
    int jamaisConnectes;
    int tauxActivation;
    List<MetricRow> repartitionStatut;
    List<MetricRow> repartitionRole;
    List<MetricRow> repartitionDepartement;
    List<AccessHealthItem> hygieneAcces;
    List<WatchAccount> comptesASurveiller;

    @Value
    @Builder
    public static class MetricRow {
        String label;
        int value;
        int pct;
        String tone;
    }

    @Value
    @Builder
    public static class AccessHealthItem {
        String label;
        int value;
        String status;
        String tone;
    }

    @Value
    @Builder
    public static class WatchAccount {
        String initials;
        String name;
        String role;
        String status;
        String priority;
        String detail;
        String tone;
    }
}
