package ma.pfe.rh.users.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import ma.pfe.rh.users.domain.Role;
import ma.pfe.rh.users.dto.AppraisalGridDtos.GridDetail;
import ma.pfe.rh.users.dto.AppraisalGridDtos.GridSummary;
import ma.pfe.rh.users.dto.AppraisalGridDtos.PublishRequest;
import ma.pfe.rh.users.service.AppraisalGridConfigurationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/appraisal-grids")
@RequiredArgsConstructor
public class AppraisalGridController {

    private final AppraisalGridConfigurationService service;

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public List<GridSummary> list(HttpServletRequest http) {
        requireRh(http);
        return service.list();
    }

    @GetMapping(value = "/available-departments", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<String> availableDepartments(HttpServletRequest http) {
        requireRh(http);
        return service.availableDepartments();
    }

    @GetMapping(value = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public GridDetail detail(HttpServletRequest http, @PathVariable Long id) {
        requireRh(http);
        return service.detail(id);
    }

    @GetMapping(value = "/{id}/versions", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<GridSummary> versions(HttpServletRequest http, @PathVariable Long id) {
        requireRh(http);
        return service.versions(id);
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public GridDetail create(HttpServletRequest http, @Valid @RequestBody PublishRequest request) {
        requireRh(http);
        return service.create(request);
    }

    @PostMapping(
            value = "/{id}/versions",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public GridDetail publishVersion(
            HttpServletRequest http,
            @PathVariable Long id,
            @Valid @RequestBody PublishRequest request
    ) {
        requireRh(http);
        return service.publishVersion(id, request);
    }

    private static void requireRh(HttpServletRequest http) {
        if (GatewayHeaders.requireRole(http) != Role.RH) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Permission RH requise");
        }
    }
}
