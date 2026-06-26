package ma.pfe.rh.leaves.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import ma.pfe.rh.leaves.domain.HolidayKind;

import java.time.LocalDate;

@Data
public class PublicHolidayRequest {
    @NotNull
    private LocalDate date;

    @NotBlank
    private String name;

    private HolidayKind kind = HolidayKind.RELIGIOUS;

    private Boolean active = true;
}
