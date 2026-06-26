package ma.pfe.rh.payroll.storage;

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
public class ExpenseFileStorage {

    private static final long MAX_SIZE = 5L * 1024L * 1024L;
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("pdf", "jpg", "jpeg", "png");

    private final Path baseDir;

    public ExpenseFileStorage(@Value("${app.uploads.dir}") String dir) {
        this.baseDir = Path.of(dir).toAbsolutePath().normalize();
    }

    public String store(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Fichier vide");
        }
        if (file.getSize() > MAX_SIZE) {
            throw new IllegalArgumentException("Le justificatif ne doit pas depasser 5 Mo");
        }

        String original = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
        String ext = extension(original).toLowerCase(Locale.ROOT);
        if (!ALLOWED_EXTENSIONS.contains(ext)) {
            throw new IllegalArgumentException("Formats acceptes : PDF, JPG ou PNG");
        }

        Path dir = baseDir.resolve("expenses");
        Files.createDirectories(dir);
        String name = UUID.randomUUID() + "." + ext;
        Files.copy(file.getInputStream(), dir.resolve(name), StandardCopyOption.REPLACE_EXISTING);
        return "/uploads/expenses/" + name;
    }

    private String extension(String filename) {
        int i = filename.lastIndexOf('.');
        if (i < 0) {
            return "";
        }
        return filename.substring(i + 1);
    }
}
