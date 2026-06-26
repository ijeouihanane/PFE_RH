package ma.pfe.rh.documents.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class FileStorageService {

    private final Path baseDir;

    public FileStorageService(@Value("${app.uploads.dir}") String dir) {
        this.baseDir = Path.of(dir).toAbsolutePath().normalize();
    }

    public String storeDocumentFile(Long documentId, MultipartFile file, Set<String> allowedExt) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Fichier vide");
        }
        String original = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
        String ext = extension(original).toLowerCase(Locale.ROOT);
        if (!allowedExt.contains(ext)) {
            throw new IllegalArgumentException("Extension non autorisée: ." + ext);
        }
        Path dir = baseDir.resolve("documents").resolve(String.valueOf(documentId));
        Files.createDirectories(dir);
        String name = UUID.randomUUID() + "." + ext;
        Path target = dir.resolve(name);
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        return "/uploads/documents/" + documentId + "/" + name;
    }

    public String storeRequestFile(Long requestId, MultipartFile file) throws IOException {
        return storeUnder("doc-requests", requestId, file, Set.of("pdf"));
    }

    /**
     * Sauvegarde le PDF d'un contrat généré.
     * Chemin : uploads/contracts/{employeeId}/{contractId}/contrat.pdf
     */
    public String storeContractPdf(Long employeeId, Long contractId, byte[] pdfBytes) throws IOException {
        Path dir = baseDir.resolve("contracts")
                .resolve(String.valueOf(employeeId))
                .resolve(String.valueOf(contractId));
        Files.createDirectories(dir);
        Path target = dir.resolve("contrat.pdf");
        Files.write(target, pdfBytes);
        return "/uploads/contracts/" + employeeId + "/" + contractId + "/contrat.pdf";
    }


    private String storeUnder(String folder, Long id, MultipartFile file, Set<String> allowedExt) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Fichier vide");
        }
        String original = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
        String ext = extension(original).toLowerCase(Locale.ROOT);
        if (!allowedExt.contains(ext)) {
            throw new IllegalArgumentException("Extension non autorisée: ." + ext);
        }
        Path dir = baseDir.resolve(folder).resolve(String.valueOf(id));
        Files.createDirectories(dir);
        String name = UUID.randomUUID() + "." + ext;
        Path target = dir.resolve(name);
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        return "/uploads/" + folder + "/" + id + "/" + name;
    }

    private String extension(String filename) {
        int i = filename.lastIndexOf('.');
        if (i < 0) {
            return "";
        }
        return filename.substring(i + 1);
    }
}
