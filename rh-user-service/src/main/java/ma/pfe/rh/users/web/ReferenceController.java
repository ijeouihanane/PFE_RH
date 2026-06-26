package ma.pfe.rh.users.web;

import jakarta.servlet.http.HttpServletRequest;
import ma.pfe.rh.users.domain.Role;
import ma.pfe.rh.users.service.AppraisalGridConfigurationService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/reference")
public class ReferenceController {

    @GetMapping("/departments")
    public List<String> departments(HttpServletRequest http) {
        if (GatewayHeaders.requireRole(http) != Role.RH) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Permission RH requise");
        }
        return AppraisalGridConfigurationService.DEPARTMENTS;
    }
}
