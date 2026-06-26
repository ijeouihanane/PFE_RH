package ma.pfe.rh.timesheets.service;

import lombok.RequiredArgsConstructor;
import ma.pfe.rh.timesheets.domain.Project;
import ma.pfe.rh.timesheets.domain.ProjectAssignment;
import ma.pfe.rh.timesheets.dto.ProjectRequest;
import ma.pfe.rh.timesheets.dto.ProjectResponse;
import ma.pfe.rh.timesheets.integration.OrgDirectory;
import ma.pfe.rh.timesheets.repo.ProjectAssignmentRepository;
import ma.pfe.rh.timesheets.repo.ProjectRepository;
import ma.pfe.rh.timesheets.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final ProjectAssignmentRepository assignmentRepository;
    private final OrgDirectory orgDirectory;

    @Transactional
    public ProjectResponse createProject(Long managerId, ProjectRequest req) {
        Project p = Project.builder()
                .nom(req.getNom())
                .description(req.getDescription())
                .managerId(managerId)
                .actif(true)
                .createdAt(Instant.now())
                .build();
        return toDto(projectRepository.save(p));
    }

    @Transactional(readOnly = true)
    public List<ProjectResponse> myProjects(Long managerId) {
        return projectRepository.findByManagerIdAndActifTrue(managerId).stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public void assignEmployee(Long managerId, Long projectId, Long employeeId) {
        Project p = projectRepository.findById(projectId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Projet introuvable"));
        
        if (!p.getManagerId().equals(managerId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Action non autorisée");
        }

        // Remove existing assignments for this employee (an employee can only have one active project)
        assignmentRepository.findByEmployeeId(employeeId).forEach(assignmentRepository::delete);

        ProjectAssignment assignment = ProjectAssignment.builder()
                .project(p)
                .employeeId(employeeId)
                .assignedAt(Instant.now())
                .build();
        assignmentRepository.save(assignment);
    }

    @Transactional
    public void unassignEmployee(Long managerId, Long projectId, Long employeeId) {
        Project p = projectRepository.findById(projectId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Projet introuvable"));

        if (!p.getManagerId().equals(managerId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Action non autorisée");
        }

        assignmentRepository.deleteByProjectIdAndEmployeeId(projectId, employeeId);
    }

    @Transactional(readOnly = true)
    public ProjectResponse getAssignedProject(Long employeeId) {
        return assignmentRepository.findByEmployeeId(employeeId).stream()
                .findFirst()
                .map(a -> toDto(a.getProject()))
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<ProjectResponse> availableForTimesheet(Long userId, String role) {
        java.util.LinkedHashMap<Long, Project> projects = new java.util.LinkedHashMap<>();
        assignmentRepository.findByEmployeeId(userId).stream()
                .map(ProjectAssignment::getProject)
                .filter(Project::isActif)
                .forEach(p -> projects.put(p.getId(), p));
        if ("MANAGER".equals(role)) {
            projectRepository.findByManagerIdAndActifTrue(userId)
                    .forEach(p -> projects.put(p.getId(), p));
        }
        return projects.values().stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public boolean canUseProject(Long userId, String role, Long projectId) {
        if (projectId == null) {
            return false;
        }
        if ("MANAGER".equals(role)) {
            boolean owns = projectRepository.findById(projectId)
                    .filter(Project::isActif)
                    .map(p -> p.getManagerId().equals(userId))
                    .orElse(false);
            if (owns) {
                return true;
            }
        }
        return assignmentRepository.existsByProjectIdAndEmployeeId(projectId, userId);
    }

    @Transactional(readOnly = true)
    public String projectName(Long projectId) {
        if (projectId == null) {
            return null;
        }
        return projectRepository.findById(projectId)
                .map(Project::getNom)
                .orElse(null);
    }

    private ProjectResponse toDto(Project p) {
        return ProjectResponse.builder()
                .id(p.getId())
                .nom(p.getNom())
                .description(p.getDescription())
                .managerId(p.getManagerId())
                .actif(p.isActif())
                .members(assignmentRepository.findAll().stream()
                        .filter(a -> a.getProject().getId().equals(p.getId()))
                        .map(ProjectAssignment::getEmployeeId)
                        .toList())
                .build();
    }
}
