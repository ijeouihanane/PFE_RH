package ma.pfe.rh.leaves.dto;

import lombok.Builder;
import lombok.Value;
import ma.pfe.rh.leaves.domain.HolidayKind;
import ma.pfe.rh.leaves.domain.HolidaySource;
import ma.pfe.rh.leaves.domain.PublicHoliday;

import java.time.LocalDate;

@Value
@Builder
public class PublicHolidayDto {
    Long id;
    LocalDate date;
    int year;
    String name;
    HolidayKind kind;
    HolidaySource source;
    boolean locked;
    boolean active;

    public static PublicHolidayDto from(PublicHoliday h) {
        return PublicHolidayDto.builder()
                .id(h.getId())
                .date(h.getDate())
                .year(h.getYear())
                .name(h.getName())
                .kind(h.getKind())
                .source(h.getSource())
                .locked(h.isLocked())
                .active(h.isActive())
                .build();
    }
}
