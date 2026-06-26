package ma.pfe.rh.documents.service;

import lombok.extern.slf4j.Slf4j;
import ma.pfe.rh.documents.domain.AiDocument;
import ma.pfe.rh.documents.domain.ChatLog;
import ma.pfe.rh.documents.dto.AiChatResponse;
import ma.pfe.rh.documents.dto.AiIndexResponse;
import ma.pfe.rh.documents.integration.AiBridge;
import ma.pfe.rh.documents.repo.AiDocumentRepository;
import ma.pfe.rh.documents.repo.ChatLogRepository;
import ma.pfe.rh.documents.web.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Service métier pour le module IA : gestion des PDFs indexés
 * et du chatbot RAG. Entièrement séparé de DocumentCatalogService.
 */
@Service
@Slf4j
public class AiDocumentService {

    private final AiDocumentRepository aiDocumentRepository;
    private final ChatLogRepository chatLogRepository;
    private final AiBridge aiBridge;
    private final Path uploadsBase;

    public AiDocumentService(
            AiDocumentRepository aiDocumentRepository,
            ChatLogRepository chatLogRepository,
            AiBridge aiBridge,
            @Value("${app.uploads.dir}") String uploadsDir) {
        this.aiDocumentRepository = aiDocumentRepository;
        this.chatLogRepository = chatLogRepository;
        this.aiBridge = aiBridge;
        this.uploadsBase = Path.of(uploadsDir).toAbsolutePath().normalize();
    }

    // ─── Upload + Indexation ─────────────────────────────────────

    @Transactional
    public AiDocument uploadAndIndex(Long rhUserId, String titre, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Fichier vide");
        }

        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document.pdf";
        String ext = originalName.substring(originalName.lastIndexOf('.') + 1).toLowerCase();
        if (!"pdf".equals(ext)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Seuls les fichiers PDF sont acceptés");
        }

        // 1. Sauvegarder l'entité pour obtenir l'ID
        AiDocument doc = AiDocument.builder()
                .titre(titre.trim())
                .originalFileName(originalName)
                .filePath("")  // sera mis à jour après stockage
                .fichierUrl("")
                .uploadedBy(rhUserId)
                .indexedInAI(false)
                .createdAt(Instant.now())
                .build();
        doc = aiDocumentRepository.save(doc);

        // 2. Stocker le fichier sur le disque
        Path dir = uploadsBase.resolve("ai-docs").resolve(String.valueOf(doc.getId()));
        Files.createDirectories(dir);
        String storedName = UUID.randomUUID() + ".pdf";
        Path target = dir.resolve(storedName);
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);

        String absolutePath = target.toAbsolutePath().normalize().toString();
        String relativeUrl = "/uploads/ai-docs/" + doc.getId() + "/" + storedName;

        doc.setFilePath(absolutePath);
        doc.setFichierUrl(relativeUrl);

        // 3. Appeler Python pour indexer (non-bloquant)
        AiIndexResponse aiResp = aiBridge.indexDocument(doc.getId(), originalName, absolutePath);
        if (aiResp != null && "success".equals(aiResp.getStatus())) {
            doc.setIndexedInAI(true);
            doc.setNbPages(aiResp.getNbPages());
            doc.setNbChunks(aiResp.getNbChunks());
            doc.setSummary(aiResp.getSummary());
            doc.setKeywords(aiResp.getKeywords());
            log.info("PDF indexé : {} — {} pages, {} chunks", originalName, aiResp.getNbPages(), aiResp.getNbChunks());
        } else {
            doc.setIndexedInAI(false);
            log.warn("Indexation échouée pour {} — le document sera ré-indexable", originalName);
        }

        return aiDocumentRepository.save(doc);
    }

    // ─── Liste des documents IA ──────────────────────────────────

    public List<AiDocument> listAll() {
        return aiDocumentRepository.findAllByOrderByCreatedAtDesc();
    }

    // ─── Suppression ─────────────────────────────────────────────

    @Transactional
    public void delete(long docId) {
        AiDocument doc = aiDocumentRepository.findById(docId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Document IA introuvable"));

        // Supprimer les vecteurs de ChromaDB
        if (Boolean.TRUE.equals(doc.getIndexedInAI())) {
            aiBridge.deleteDocumentVectors(doc.getId());
        }

        // Supprimer le fichier physique
        try {
            Path filePath = Path.of(doc.getFilePath());
            Files.deleteIfExists(filePath);
            // Supprimer le dossier parent s'il est vide
            Path parentDir = filePath.getParent();
            if (parentDir != null && Files.isDirectory(parentDir)) {
                try (var entries = Files.list(parentDir)) {
                    if (entries.findFirst().isEmpty()) {
                        Files.deleteIfExists(parentDir);
                    }
                }
            }
        } catch (IOException e) {
            log.warn("Erreur suppression fichier physique : {}", e.getMessage());
        }

        aiDocumentRepository.delete(doc);
        log.info("Document IA supprimé : id={}, titre={}", docId, doc.getTitre());
    }

    // ─── Ré-indexation ───────────────────────────────────────────

    @Transactional
    public AiDocument reindex(long docId) {
        AiDocument doc = aiDocumentRepository.findById(docId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Document IA introuvable"));

        if (doc.getFilePath() == null || doc.getFilePath().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Fichier introuvable pour ce document");
        }

        // Supprimer les anciens vecteurs d'abord
        aiBridge.deleteDocumentVectors(doc.getId());

        // Ré-indexer
        AiIndexResponse aiResp = aiBridge.indexDocument(
                doc.getId(), doc.getOriginalFileName(), doc.getFilePath());
        if (aiResp != null && "success".equals(aiResp.getStatus())) {
            doc.setIndexedInAI(true);
            doc.setNbPages(aiResp.getNbPages());
            doc.setNbChunks(aiResp.getNbChunks());
            doc.setSummary(aiResp.getSummary());
            doc.setKeywords(aiResp.getKeywords());
        } else {
            doc.setIndexedInAI(false);
        }

        return aiDocumentRepository.save(doc);
    }

    // ─── Chatbot ─────────────────────────────────────────────────

    @Transactional
    public AiChatResponse chat(Long userId, String question) {
        if (question == null || question.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La question ne peut pas être vide");
        }

        AiChatResponse response = aiBridge.chat(question, userId);

        // Sauvegarder dans l'historique
        ChatLog logEntry = ChatLog.builder()
                .userId(userId)
                .question(question)
                .answer(response.getAnswer())
                .docSource(response.getDocSource())
                .pageNumber(response.getPageNumber())
                .pageRange(response.getPageRange())
                .confidenceScore(response.getConfidenceScore())
                .answered(response.getAnswered())
                .modelUsed(response.getModelUsed())
                .createdAt(Instant.now())
                .build();
        chatLogRepository.save(logEntry);

        return response;
    }

    // ─── Historique ──────────────────────────────────────────────

    public List<ChatLog> chatHistory(Long userId) {
        return chatLogRepository.findTop20ByUserIdOrderByCreatedAtDesc(userId);
    }

    // ─── Statut IA ───────────────────────────────────────────────

    public Map<String, Object> aiStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("available", aiBridge.isAvailable());
        status.put("documentsIndexed", aiBridge.countIndexedDocuments());
        status.put("documentsInDb", aiDocumentRepository.countByIndexedInAITrue());
        return status;
    }
}
