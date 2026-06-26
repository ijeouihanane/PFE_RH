package ma.pfe.rh.timesheets.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import ma.pfe.rh.timesheets.dto.ProjectRequest;
import ma.pfe.rh.timesheets.dto.ProjectResponse;
import ma.pfe.rh.timesheets.service.ProjectService;
import ma.pfe.rh.timesheets.web.security.Role;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ProjectResponse create(HttpServletRequest http, @Valid @RequestBody ProjectRequest req) {
        if (GatewayHeaders.requireRole(http) != Role.MANAGER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Accès manager requis");
        }
        return projectService.createProject(GatewayHeaders.requireUserId(http), req);
    }

    @GetMapping(value = "/mine", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<ProjectResponse> mine(HttpServletRequest http) {
        if (GatewayHeaders.requireRole(http) != Role.MANAGER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Accès manager requis");
        }
        return projectService.myProjects(GatewayHeaders.requireUserId(http));
    }

    @PostMapping(value = "/{id}/assign/{employeeId}")
    public void assign(HttpServletRequest http, @PathVariable long id, @PathVariable long employeeId) {
        if (GatewayHeaders.requireRole(http) != Role.MANAGER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Accès manager requis");
        }
        projectService.assignEmployee(GatewayHeaders.requireUserId(http), id, employeeId);
    }

    @DeleteMapping(value = "/{id}/assign/{employeeId}")
    public void unassign(HttpServletRequest http, @PathVariable long id, @PathVariable long employeeId) {
        if (GatewayHeaders.requireRole(http) != Role.MANAGER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Accès manager requis");
        }
        projectService.unassignEmployee(GatewayHeaders.requireUserId(http), id, employeeId);
    }

    @GetMapping(value = "/assigned", produces = MediaType.APPLICATION_JSON_VALUE)
    public ProjectResponse assigned(HttpServletRequest http) {
        return projectService.getAssignedProject(GatewayHeaders.requireUserId(http));
    }

    @GetMapping(value = "/timesheet-available", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<ProjectResponse> timesheetAvailable(HttpServletRequest http) {
        return projectService.availableForTimesheet(
                GatewayHeaders.requireUserId(http),
                GatewayHeaders.requireRole(http).name()
        );
    }
}
