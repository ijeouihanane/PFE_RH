package ma.pfe.rh.payroll.service;

import lombok.RequiredArgsConstructor;
import ma.pfe.rh.payroll.domain.PayrollProfile;
import ma.pfe.rh.payroll.dto.PayrollProfileDTO;
import ma.pfe.rh.payroll.repo.PayrollProfileRepository;
import ma.pfe.rh.payroll.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class PayrollProfileService {

    private final PayrollProfileRepository profileRepository;

    public PayrollProfileDTO getByEmployeeId(Long employeeId) {
        PayrollProfile p = profileRepository.findByEmployeeId(employeeId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "Profil paie introuvable pour l'employé #" + employeeId));
        return toDTO(p);
    }

    @Transactional
    public PayrollProfileDTO createOrUpdate(Long employeeId, PayrollProfileDTO dto) {
        if (dto.getBaseSalary() == null || dto.getBaseSalary().signum() <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Le salaire de base est obligatoire et doit être positif.");
        }
        PayrollProfile p = profileRepository.findByEmployeeId(employeeId).orElse(null);
        Instant now = Instant.now();
        if (p == null) {
            p = PayrollProfile.builder()
                    .employeeId(employeeId)
                    .baseSalary(dto.getBaseSalary())
                    .fixedBonus(dto.getFixedBonus())
                    .active(dto.isActive())
                    .createdAt(now)
                    .updatedAt(now)
                    .build();
        } else {
            p.setBaseSalary(dto.getBaseSalary());
            p.setFixedBonus(dto.getFixedBonus());
            p.setActive(dto.isActive());
            p.setUpdatedAt(now);
        }
        PayrollProfile saved = profileRepository.save(p);
        return toDTO(saved);
    }

    private PayrollProfileDTO toDTO(PayrollProfile p) {
        return PayrollProfileDTO.builder()
                .employeeId(p.getEmployeeId())
                .baseSalary(p.getBaseSalary())
                .fixedBonus(p.getFixedBonus())
                .active(p.isActive())
                .build();
    }
}
