package ma.pfe.rh.documents.web;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import ma.pfe.rh.documents.domain.AiDocument;
import ma.pfe.rh.documents.domain.ChatLog;
import ma.pfe.rh.documents.dto.AiChatResponse;
import ma.pfe.rh.documents.service.AiDocumentService;
import ma.pfe.rh.documents.web.security.Role;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * Controller dédié au module IA. Séparé de DocumentController.
 * Préfixe : /api/documents/ai/
 */
@RestController
@RequestMapping("/api/documents/ai")
@RequiredArgsConstructor
public class AiDocumentController {

    private final AiDocumentService aiDocumentService;

    // ─── Upload PDF pour le chatbot (RH uniquement) ──────────────

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<AiDocument> upload(
            HttpServletRequest http,
            @RequestParam("titre") String titre,
            @RequestParam("file") MultipartFile file) throws Exception {
        Role r = GatewayHeaders.requireRole(http);
        if (r != Role.RH) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Accès réservé au RH");
        }
        Long userId = GatewayHeaders.requireUserId(http);
        AiDocument doc = aiDocumentService.uploadAndIndex(userId, titre, file);
        return ResponseEntity.ok(doc);
    }

    // ─── Liste des documents IA (RH uniquement) ──────────────────

    @GetMapping(value = "/list", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<AiDocument> list(HttpServletRequest http) {
        Role r = GatewayHeaders.requireRole(http);
        if (r != Role.RH) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Accès réservé au RH");
        }
        return aiDocumentService.listAll();
    }

    // ─── Supprimer un document IA (RH uniquement) ────────────────

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(HttpServletRequest http, @PathVariable long id) {
        Role r = GatewayHeaders.requireRole(http);
        if (r != Role.RH) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Accès réservé au RH");
        }
        aiDocumentService.delete(id);
        return ResponseEntity.noContent().build();
    }

    // ─── Ré-indexer un document IA (RH uniquement) ───────────────

    @PostMapping(value = "/reindex/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<AiDocument> reindex(HttpServletRequest http, @PathVariable long id) {
        Role r = GatewayHeaders.requireRole(http);
        if (r != Role.RH) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Accès réservé au RH");
        }
        return ResponseEntity.ok(aiDocumentService.reindex(id));
    }

    // ─── Statut du service IA (tous les rôles authentifiés) ──────

    @GetMapping(value = "/status", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> status(HttpServletRequest http) {
        GatewayHeaders.requireUserId(http);
        return aiDocumentService.aiStatus();
    }

    // ─── Chatbot : poser une question (EMPLOYEE, MANAGER, RH) ───

    @PostMapping(value = "/chat", consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<AiChatResponse> chat(
            HttpServletRequest http,
            @RequestBody Map<String, String> body) {
        Role r = GatewayHeaders.requireRole(http);
        if (r == Role.ADMIN) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Chatbot non accessible à l'administrateur");
        }
        Long userId = GatewayHeaders.requireUserId(http);
        String question = body.get("question");
        return ResponseEntity.ok(aiDocumentService.chat(userId, question));
    }

    // ─── Historique du chat (EMPLOYEE, MANAGER, RH) ──────────────

    @GetMapping(value = "/chat/history", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<ChatLog> chatHistory(HttpServletRequest http) {
        Role r = GatewayHeaders.requireRole(http);
        if (r == Role.ADMIN) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Historique non accessible à l'administrateur");
        }
        Long userId = GatewayHeaders.requireUserId(http);
        return aiDocumentService.chatHistory(userId);
    }
}
