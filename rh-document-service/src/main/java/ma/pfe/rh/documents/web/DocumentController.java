package ma.pfe.rh.documents.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import ma.pfe.rh.documents.dto.DocumentCreateDto;
import ma.pfe.rh.documents.dto.DocumentRequestCreateDto;
import ma.pfe.rh.documents.dto.DocumentRequestResponse;
import ma.pfe.rh.documents.dto.DocumentResponse;
import ma.pfe.rh.documents.service.DocumentCatalogService;
import ma.pfe.rh.documents.web.security.Role;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentCatalogService documentCatalogService;

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public List<DocumentResponse> list(HttpServletRequest http) {
        GatewayHeaders.requireUserId(http);
        return documentCatalogService.listActive();
    }

    @GetMapping(value = "/announcements/latest", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<DocumentResponse> latest(HttpServletRequest http) {
        GatewayHeaders.requireUserId(http);
        return documentCatalogService.latestAnnouncements();
    }

    @GetMapping(value = "/announcements", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<DocumentResponse> announcements(HttpServletRequest http) {
        Role r = GatewayHeaders.requireRole(http);
        if (r == Role.RH) {
            return documentCatalogService.listAllAnnouncementsRh();
        }
        return documentCatalogService.listActiveAnnouncements();
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public DocumentResponse create(HttpServletRequest http, @Valid @RequestBody DocumentCreateDto dto) {
        Role r = GatewayHeaders.requireRole(http);
        DocumentCatalogService.requireRhRole(r);
        return documentCatalogService.create(GatewayHeaders.requireUserId(http), dto);
    }

    @PostMapping(value = "/{id}/file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public DocumentResponse attach(HttpServletRequest http, @PathVariable long id, MultipartFile file)
            throws Exception {
        Role r = GatewayHeaders.requireRole(http);
        DocumentCatalogService.requireRhRole(r);
        return documentCatalogService.attachFile(GatewayHeaders.requireUserId(http), id, file);
    }

    @PatchMapping("/{id}/deactivate")
    public void deactivate(HttpServletRequest http, @PathVariable long id) {
        Role r = GatewayHeaders.requireRole(http);
        DocumentCatalogService.requireRhRole(r);
        documentCatalogService.deactivate(GatewayHeaders.requireUserId(http), id);
    }

    @PatchMapping("/announcements/{id}/archive")
    public void archiveAnnouncement(HttpServletRequest http, @PathVariable long id) {
        Role r = GatewayHeaders.requireRole(http);
        DocumentCatalogService.requireRhRole(r);
        documentCatalogService.deactivate(GatewayHeaders.requireUserId(http), id);
    }

    @PatchMapping("/announcements/{id}/unarchive")
    public void unarchiveAnnouncement(HttpServletRequest http, @PathVariable long id) {
        Role r = GatewayHeaders.requireRole(http);
        DocumentCatalogService.requireRhRole(r);
        documentCatalogService.activate(GatewayHeaders.requireUserId(http), id);
    }

    @PatchMapping(value = "/announcements/{id}/pin", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public DocumentResponse pinAnnouncement(HttpServletRequest http, @PathVariable long id,
            @RequestBody Map<String, Boolean> body) {
        Role r = GatewayHeaders.requireRole(http);
        DocumentCatalogService.requireRhRole(r);
        return documentCatalogService.setPinned(GatewayHeaders.requireUserId(http), id,
                Boolean.TRUE.equals(body.get("epinglee")));
    }

    @DeleteMapping("/{id}")
    public void delete(HttpServletRequest http, @PathVariable long id) {
        Role r = GatewayHeaders.requireRole(http);
        DocumentCatalogService.requireRhRole(r);
        documentCatalogService.delete(GatewayHeaders.requireUserId(http), id);
    }

    @PostMapping(value = "/requests", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public DocumentRequestResponse createRequest(HttpServletRequest http,
            @Valid @RequestBody DocumentRequestCreateDto dto) {
        Role r = GatewayHeaders.requireRole(http);
        if (r != Role.EMPLOYEE && r != Role.MANAGER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Action réservée aux employés");
        }
        return documentCatalogService.createRequest(GatewayHeaders.requireUserId(http), dto);
    }

    @GetMapping(value = "/requests/my", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<DocumentRequestResponse> myRequests(HttpServletRequest http) {
        return documentCatalogService.myRequests(GatewayHeaders.requireUserId(http));
    }

    @GetMapping(value = "/requests/all", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<DocumentRequestResponse> allRequests(HttpServletRequest http) {
        Role r = GatewayHeaders.requireRole(http);
        DocumentCatalogService.requireRhRole(r);
        return documentCatalogService.allRequestsRh(GatewayHeaders.requireUserId(http));
    }

    @PostMapping(value = "/requests/{id}/complete", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public DocumentRequestResponse complete(HttpServletRequest http, @PathVariable long id, MultipartFile file)
            throws Exception {
        Role r = GatewayHeaders.requireRole(http);
        DocumentCatalogService.requireRhRole(r);
        return documentCatalogService.completeRequest(GatewayHeaders.requireUserId(http), id, file);
    }

    @PostMapping(value = "/requests/{id}/refuse", consumes = MediaType.APPLICATION_JSON_VALUE)
    public DocumentRequestResponse refuse(HttpServletRequest http, @PathVariable long id,
            @RequestBody Map<String, String> body) {
        Role r = GatewayHeaders.requireRole(http);
        DocumentCatalogService.requireRhRole(r);
        return documentCatalogService.refuseRequest(GatewayHeaders.requireUserId(http), id, body.get("commentaire"));
    }
}
