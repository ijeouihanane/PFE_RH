package ma.pfe.rh.documents.integration;

import lombok.extern.slf4j.Slf4j;
import ma.pfe.rh.documents.dto.AiChatResponse;
import ma.pfe.rh.documents.dto.AiIndexResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

/**
 * Pont Java → Python AI Service (FastAPI, port 8000).
 * Tous les appels sont protégés par try-catch pour ne pas bloquer
 * le flux métier si le service Python est indisponible.
 */
@Service
@Slf4j
public class AiBridge {

    private final RestTemplate restTemplate = new RestTemplate();
    private final String baseUrl;

    public AiBridge(@Value("${app.ai.base-url}") String baseUrl) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    /**
     * Indexe un PDF dans ChromaDB via le service Python.
     * Retourne null si Python est down (non-bloquant).
     */
    public AiIndexResponse indexDocument(Long docId, String docName, String absoluteFilePath) {
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("file_path", absoluteFilePath);
            body.put("doc_id", String.valueOf(docId));
            body.put("doc_name", docName);

            ResponseEntity<AiIndexResponse> resp = restTemplate.postForEntity(
                    baseUrl + "/index", body, AiIndexResponse.class);
            log.info("Document indexé avec succès — {} chunks",
                    resp.getBody() != null ? resp.getBody().getNbChunks() : "?");
            return resp.getBody();
        } catch (Exception e) {
            log.warn("Indexation IA échouée (Python down ?) : {}", e.getMessage());
            return null;
        }
    }

    /**
     * Pose une question au chatbot RAG.
     */
    public AiChatResponse chat(String question, Long userId) {
        Map<String, Object> body = new HashMap<>();
        body.put("question", question);
        body.put("user_id", String.valueOf(userId));

        ResponseEntity<AiChatResponse> resp = restTemplate.postForEntity(
                baseUrl + "/chat", body, AiChatResponse.class);
        return resp.getBody();
    }

    /**
     * Supprime les vecteurs d'un document de ChromaDB.
     */
    public void deleteDocumentVectors(Long docId) {
        try {
            restTemplate.delete(baseUrl + "/documents/" + docId);
            log.info("Vecteurs supprimés pour doc {}", docId);
        } catch (Exception e) {
            log.warn("Suppression vecteurs échouée : {}", e.getMessage());
        }
    }

    /**
     * Vérifie si le service Python est disponible.
     */
    public boolean isAvailable() {
        try {
            restTemplate.getForEntity(baseUrl + "/health", Map.class);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Retourne le nombre de documents indexés dans ChromaDB.
     */
    public int countIndexedDocuments() {
        try {
            @SuppressWarnings("rawtypes")
            ResponseEntity<Map> resp = restTemplate.getForEntity(baseUrl + "/documents", Map.class);
            if (resp.getBody() != null && resp.getBody().containsKey("total")) {
                return ((Number) resp.getBody().get("total")).intValue();
            }
            return 0;
        } catch (Exception e) {
            return 0;
        }
    }
}
