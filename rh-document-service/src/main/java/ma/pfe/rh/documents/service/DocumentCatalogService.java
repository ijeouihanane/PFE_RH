package ma.pfe.rh.documents.service;

import lombok.RequiredArgsConstructor;
import ma.pfe.rh.documents.domain.DocType;
import ma.pfe.rh.documents.domain.DocumentEntity;
import ma.pfe.rh.documents.domain.DocumentRequestEntity;
import ma.pfe.rh.documents.domain.DocumentRequestStatus;
import ma.pfe.rh.documents.dto.DocumentCreateDto;
import ma.pfe.rh.documents.dto.DocumentRequestCreateDto;
import ma.pfe.rh.documents.dto.DocumentRequestResponse;
import ma.pfe.rh.documents.dto.DocumentResponse;

import ma.pfe.rh.documents.kafka.DocumentKafkaProducer;
import ma.pfe.rh.documents.repo.DocumentRepository;
import ma.pfe.rh.documents.repo.DocumentRequestRepository;
import ma.pfe.rh.documents.storage.FileStorageService;
import ma.pfe.rh.documents.web.ApiException;
import ma.pfe.rh.documents.web.security.Role;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class DocumentCatalogService {

    private final DocumentRepository documentRepository;
    private final DocumentRequestRepository documentRequestRepository;
    private final DocumentKafkaProducer documentKafkaProducer;
    private final FileStorageService fileStorageService;

    public List<DocumentResponse> listActive() {
        return documentRepository.findByActifTrueOrderByPublieAtDesc().stream().map(DocumentResponse::from).toList();
    }

    public List<DocumentResponse> latestAnnouncements() {
        return documentRepository.findTop3ByActifTrueAndTypeOrderByPublieAtDesc(DocType.ANNONCE).stream()
                .map(DocumentResponse::from)
                .toList();
    }

    public List<DocumentResponse> listActiveAnnouncements() {
        return documentRepository.findByActifTrueAndTypeOrderByEpingleeDescPublieAtDesc(DocType.ANNONCE).stream()
                .map(DocumentResponse::from)
                .toList();
    }

    public List<DocumentResponse> listAllAnnouncementsRh() {
        return documentRepository.findByTypeOrderByEpingleeDescPublieAtDesc(DocType.ANNONCE).stream()
                .map(DocumentResponse::from)
                .toList();
    }

    @Transactional
    public DocumentResponse create(Long rhUserId, DocumentCreateDto dto) {
        Instant now = Instant.now();
        DocumentEntity e = DocumentEntity.builder()
                .titre(dto.getTitre().trim())
                .type(dto.getType())
                .contenu(dto.getContenu())
                .categorie(trimToNull(dto.getCategorie()))
                .publiePar(rhUserId)
                .publieAt(now)
                .actif(true)
                .epinglee(Boolean.TRUE.equals(dto.getEpinglee()))
                .build();
        DocumentEntity saved = documentRepository.save(e);

        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("documentId", saved.getId());
            payload.put("titre", saved.getTitre());
            payload.put("type", saved.getType().name());
            documentKafkaProducer.published(payload);
        } catch (Exception ignored) {
            // Kafka non bloquant : l'annonce est sauvegardée même si l'événement échoue
        }

        return DocumentResponse.from(saved);
    }

    @Transactional
    public DocumentResponse attachFile(Long rhUserId, long documentId, MultipartFile file) throws IOException {
        DocumentEntity d = documentRepository.findById(documentId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Document introuvable"));
        String url = fileStorageService.storeDocumentFile(d.getId(), file,
                Set.of("pdf", "doc", "docx", "png", "jpg", "jpeg"));
        d.setFichierUrl(url);
        documentRepository.save(d);
        return DocumentResponse.from(d);
    }

    @Transactional
    public DocumentResponse setPinned(Long rhUserId, long documentId, boolean pinned) {
        DocumentEntity d = documentRepository.findById(documentId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Document introuvable"));
        d.setEpinglee(pinned);
        d.setUpdatedAt(Instant.now());
        documentRepository.save(d);
        return DocumentResponse.from(d);
    }

    @Transactional
    public void deactivate(long rhUserId, long id) {
        DocumentEntity d = documentRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Document introuvable"));
        d.setActif(false);
        d.setUpdatedAt(Instant.now());
        documentRepository.save(d);
    }

    @Transactional
    public void activate(long rhUserId, long id) {
        DocumentEntity d = documentRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Document introuvable"));
        d.setActif(true);
        d.setUpdatedAt(Instant.now());
        documentRepository.save(d);
    }

    @Transactional
    public void delete(long rhUserId, long id) {
        DocumentEntity d = documentRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Document introuvable"));
        documentRepository.delete(d);
    }

    @Transactional
    public DocumentRequestResponse createRequest(long employeeId, DocumentRequestCreateDto dto) {
        validateRequest(dto);
        Instant now = Instant.now();
        DocumentRequestEntity e = DocumentRequestEntity.builder()
                .employeeId(employeeId)
                .typeDoc(dto.getTypeDoc())
                .statut(DocumentRequestStatus.EN_ATTENTE)
                .mois(dto.getMois())
                .annee(dto.getAnnee())
                .commentaireDemande(trimToNull(dto.getCommentaireDemande()))
                .createdAt(now)
                .build();
        DocumentRequestEntity saved = documentRequestRepository.save(e);
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("requestId", saved.getId());
            payload.put("employeeId", saved.getEmployeeId());
            payload.put("typeDoc", saved.getTypeDoc().name());
            documentKafkaProducer.requestCreated(payload);
        } catch (Exception ignored) {
            // Notification non bloquante.
        }
        return DocumentRequestResponse.from(saved);
    }

    public List<DocumentRequestResponse> myRequests(long employeeId) {
        return documentRequestRepository.findByEmployeeIdOrderByCreatedAtDesc(employeeId).stream()
                .map(DocumentRequestResponse::from)
                .toList();
    }

    public List<DocumentRequestResponse> allRequestsRh(long rhUserId) {
        return documentRequestRepository.findAllByOrderByCreatedAtDesc().stream().map(DocumentRequestResponse::from)
                .toList();
    }

    @Transactional
    public DocumentRequestResponse completeRequest(long rhUserId, long requestId, MultipartFile file)
            throws IOException {
        DocumentRequestEntity e = documentRequestRepository.findById(requestId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Demande introuvable"));
        if (e.getStatut() != DocumentRequestStatus.EN_ATTENTE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Demande déjà traitée");
        }
        String url = fileStorageService.storeRequestFile(e.getId(), file);
        e.setFichierUrl(url);
        e.setStatut(DocumentRequestStatus.PRET);
        e.setProcessedAt(Instant.now());
        e.setProcessedBy(rhUserId);
        DocumentRequestEntity saved = documentRequestRepository.save(e);
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("requestId", saved.getId());
            payload.put("employeeId", saved.getEmployeeId());
            payload.put("typeDoc", saved.getTypeDoc().name());
            documentKafkaProducer.requestReady(payload);
        } catch (Exception ignored) {
            // Notification non bloquante.
        }
        return DocumentRequestResponse.from(saved);
    }

    @Transactional
    public DocumentRequestResponse refuseRequest(long rhUserId, long requestId, String commentaire) {
        DocumentRequestEntity e = documentRequestRepository.findById(requestId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Demande introuvable"));
        if (e.getStatut() != DocumentRequestStatus.EN_ATTENTE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Demande deja traitee");
        }
        if (commentaire == null || commentaire.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Motif de refus obligatoire");
        }
        e.setStatut(DocumentRequestStatus.REFUSE);
        e.setCommentaire(commentaire.trim());
        e.setProcessedAt(Instant.now());
        e.setProcessedBy(rhUserId);
        DocumentRequestEntity saved = documentRequestRepository.save(e);
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("requestId", saved.getId());
            payload.put("employeeId", saved.getEmployeeId());
            payload.put("typeDoc", saved.getTypeDoc().name());
            payload.put("motif", saved.getCommentaire());
            documentKafkaProducer.requestRefused(payload);
        } catch (Exception ignored) {
            // Notification non bloquante.
        }
        return DocumentRequestResponse.from(saved);
    }


    public static void requireRhRole(Role role) {
        if (role != Role.RH) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Accès RH requis");
        }
    }

    private static String trimToNull(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        return s.trim();
    }

    private static void validateRequest(DocumentRequestCreateDto dto) {
        if (dto.getTypeDoc() == ma.pfe.rh.documents.domain.DocumentRequestType.FICHE_PAIE) {
            if (dto.getMois() == null || dto.getMois() < 1 || dto.getMois() > 12 || dto.getAnnee() == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Mois et annee obligatoires pour une fiche de paie");
            }
        }
        if (dto.getTypeDoc() == ma.pfe.rh.documents.domain.DocumentRequestType.AUTRE
                && (dto.getCommentaireDemande() == null || dto.getCommentaireDemande().isBlank())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Commentaire obligatoire pour une demande autre");
        }
    }
}
