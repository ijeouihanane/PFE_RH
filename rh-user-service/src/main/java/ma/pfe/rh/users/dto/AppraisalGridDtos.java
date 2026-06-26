package ma.pfe.rh.users.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public final class AppraisalGridDtos {

    private AppraisalGridDtos() {
    }

    public record CriterionInput(
            @NotBlank @Size(max = 180) String label,
            @NotBlank @Size(max = 600) String description
    ) {
    }

    public record PublishRequest(
            @NotBlank @Size(max = 100) String department,
            @NotBlank @Size(max = 150) String label,
            Integer expectedVersion,
            @NotEmpty @Size(min = 2, max = 10) List<@Valid CriterionInput> criteria
    ) {
    }

    public record CriterionResponse(
            Long id,
            String label,
            String description,
            int displayOrder
    ) {
    }

    public record GridSummary(
            Long id,
            String code,
            String label,
            String department,
            int version,
            int criterionCount,
            boolean active,
            boolean generic,
            Instant publishedAt,
            Instant updatedAt
    ) {
    }

    public record GridDetail(
            Long id,
            String code,
            String label,
            String department,
            int version,
            boolean active,
            boolean generic,
            Instant publishedAt,
            Instant updatedAt,
            List<CriterionResponse> criteria
    ) {
    }
}
