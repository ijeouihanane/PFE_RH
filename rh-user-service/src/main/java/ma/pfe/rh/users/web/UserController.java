package ma.pfe.rh.users.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import ma.pfe.rh.users.domain.Role;
import ma.pfe.rh.users.dto.ChangePasswordRequest;
import ma.pfe.rh.users.dto.EmployeeCreateRequest;
import ma.pfe.rh.users.dto.EmployeeUpdateRequest;
import ma.pfe.rh.users.dto.ProfileSelfUpdateRequest;
import ma.pfe.rh.users.dto.UserResponse;
import ma.pfe.rh.users.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping(value = "/me", produces = MediaType.APPLICATION_JSON_VALUE)
    public UserResponse me(HttpServletRequest http) {
        return userService.me(GatewayHeaders.requireUserId(http));
    }

    @PatchMapping(value = "/me", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public UserResponse updateMe(HttpServletRequest http, @RequestBody ProfileSelfUpdateRequest req) {
        return userService.updateSelf(GatewayHeaders.requireUserId(http), req);
    }

    @PostMapping(value = "/me/change-password", consumes = MediaType.APPLICATION_JSON_VALUE)
    public void changePassword(HttpServletRequest http, @Valid @RequestBody ChangePasswordRequest req) {
        userService.changePassword(GatewayHeaders.requireUserId(http), req.getAncienMotDePasse(), req.getNouveauMotDePasse());
    }

    @PostMapping(value = "/me/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public UserResponse uploadMyPhoto(HttpServletRequest http, MultipartFile file) throws Exception {
        return userService.uploadPhotoSelf(GatewayHeaders.requireUserId(http), file);
    }

    @GetMapping(value = "/team", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<UserResponse> team(HttpServletRequest http) {
        Long managerId = GatewayHeaders.requireUserId(http);
        Role role = GatewayHeaders.requireRole(http);
        if (role != Role.MANAGER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Accès manager requis");
        }
        return userService.team(managerId);
    }

    @GetMapping(value = "/{id}/summary", produces = MediaType.APPLICATION_JSON_VALUE)
    public UserResponse summary(HttpServletRequest http, @PathVariable Long id) {
        GatewayHeaders.requireUserId(http);
        return userService.summary(id);
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public List<UserResponse> search(
            HttpServletRequest http,
            @RequestParam(required = false) String departement,
            @RequestParam(required = false) String poste,
            @RequestParam(required = false) String typeContrat,
            @RequestParam(required = false) String statut
    ) {
        Role r = GatewayHeaders.requireRole(http);
        if (r != Role.RH && r != Role.MANAGER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Permission refusée");
        }
        return userService.searchRh(departement, poste, typeContrat, statut);
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public UserResponse create(HttpServletRequest http, @Valid @RequestBody EmployeeCreateRequest req) {
        requireRole(http, Role.RH);
        return userService.createEmployee(req);
    }

    @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public UserResponse update(HttpServletRequest http, @PathVariable Long id, @RequestBody EmployeeUpdateRequest req) {
        requireRole(http, Role.RH);
        return userService.updateEmployee(id, req);
    }

    @PatchMapping("/{id}/deactivate")
    public void deactivate(HttpServletRequest http, @PathVariable Long id) {
        requireRole(http, Role.RH);
        userService.deactivateEmployee(id);
    }

    @PostMapping(value = "/{id}/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public UserResponse uploadPhoto(HttpServletRequest http, @PathVariable Long id, MultipartFile file) throws Exception {
        return userService.uploadPhotoRh(GatewayHeaders.requireUserId(http), id, file);
    }

    @PostMapping(value = "/{id}/cv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public UserResponse uploadCv(HttpServletRequest http, @PathVariable Long id, MultipartFile file) throws Exception {
        return userService.uploadCvRh(GatewayHeaders.requireUserId(http), id, file);
    }

    private static void requireRole(HttpServletRequest http, Role expected) {
        Role r = GatewayHeaders.requireRole(http);
        if (r != expected) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Permission refusée");
        }
    }
}
