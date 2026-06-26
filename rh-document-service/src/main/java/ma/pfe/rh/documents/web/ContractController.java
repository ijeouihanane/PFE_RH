package ma.pfe.rh.documents.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import ma.pfe.rh.documents.domain.ContractStatus;
import ma.pfe.rh.documents.domain.ContractType;
import ma.pfe.rh.documents.dto.ContractCreateDto;
import ma.pfe.rh.documents.dto.ContractResponse;
import ma.pfe.rh.documents.dto.ContractUpdateDto;
import ma.pfe.rh.documents.service.ContractService;
import ma.pfe.rh.documents.web.security.Role;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/contracts")
@RequiredArgsConstructor
public class ContractController {

    private final ContractService contractService;

    /**
     * GET /api/contracts
     * Liste tous les contrats avec filtres optionnels.
     * Accès : RH uniquement.
     */
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public List<ContractResponse> list(
            HttpServletRequest http,
            @RequestParam(required = false) ContractType type,
            @RequestParam(required = false) ContractStatus status,
            @RequestParam(required = false) Long employeeId
    ) {
        requireRh(http);
        return contractService.list(type, status, employeeId);
    }

    /**
     * GET /api/contracts/{id}
     * Détail d'un contrat (inclut renderedHtml et clausesJson pour édition/aperçu).
     */
    @GetMapping(value = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ContractResponse getById(HttpServletRequest http, @PathVariable Long id) {
        requireRh(http);
        return contractService.getById(id);
    }

    /**
     * POST /api/contracts/drafts
     * Créer un nouveau brouillon de contrat.
     */
    @PostMapping(value = "/drafts",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ContractResponse> createDraft(
            HttpServletRequest http,
            @Valid @RequestBody ContractCreateDto dto
    ) {
        requireRh(http);
        ContractResponse response = contractService.createDraft(
                GatewayHeaders.requireUserId(http), dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * PUT /api/contracts/{id}
     * Modifier un brouillon (statut BROUILLON requis).
     */
    @PutMapping(value = "/{id}",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ContractResponse update(
            HttpServletRequest http,
            @PathVariable Long id,
            @RequestBody ContractUpdateDto dto
    ) {
        requireRh(http);
        return contractService.update(GatewayHeaders.requireUserId(http), id, dto);
    }

    /**
     * POST /api/contracts/{id}/generate
     * Génère le PDF et passe le contrat en statut GENERE.
     * Statut BROUILLON requis.
     */
    @PostMapping(value = "/{id}/generate", produces = MediaType.APPLICATION_JSON_VALUE)
    public ContractResponse generate(HttpServletRequest http, @PathVariable Long id) {
        requireRh(http);
        return contractService.generate(GatewayHeaders.requireUserId(http), id);
    }

    /**
     * DELETE /api/contracts/{id}
     * Supprime un brouillon (statut BROUILLON requis).
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(HttpServletRequest http, @PathVariable Long id) {
        requireRh(http);
        contractService.delete(GatewayHeaders.requireUserId(http), id);
        return ResponseEntity.noContent().build();
    }

    /**
     * GET /api/contracts/{id}/pdf
     * Télécharge le PDF généré (statut GENERE requis).
     * Retourne le fichier avec Content-Disposition: attachment.
     */
    @GetMapping(value = "/{id}/pdf", produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public ResponseEntity<byte[]> downloadPdf(HttpServletRequest http, @PathVariable Long id) {
        requireRh(http);
        byte[] pdfBytes = contractService.downloadPdf(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"contrat-" + id + ".pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfBytes);
    }

    // ── Helper sécurité ───────────────────────────────────────────────────────

    private static void requireRh(HttpServletRequest http) {
        Role role = GatewayHeaders.requireRole(http);
        ContractService.requireRhRole(role);
    }
}
