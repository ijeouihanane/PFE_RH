package ma.pfe.rh.leaves.repo;

import ma.pfe.rh.leaves.domain.HolidaySource;
import ma.pfe.rh.leaves.domain.PublicHoliday;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PublicHolidayRepository extends JpaRepository<PublicHoliday, Long> {

    boolean existsByYear(int year);

    List<PublicHoliday> findByYearOrderByDateAsc(int year);

    List<PublicHoliday> findByDateBetweenAndActiveTrue(LocalDate start, LocalDate end);

    Optional<PublicHoliday> findByDateAndName(LocalDate date, String name);

    List<PublicHoliday> findByYearAndSourceIn(int year, Collection<HolidaySource> sources);

    void deleteByYearAndSource(int year, HolidaySource source);
}
