package ma.pfe.rh.timesheets.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class ProjectResponse {
    Long id;
    String nom;
    String description;
    Long managerId;
    boolean actif;
    List<Long> members;
}
