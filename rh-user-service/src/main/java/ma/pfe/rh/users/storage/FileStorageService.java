package ma.pfe.rh.users.storage;

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

    public String storeUserFile(Long userId, String subFolder, MultipartFile file, Set<String> allowedExt) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Fichier vide");
        }
        String original = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
        String ext = extension(original).toLowerCase(Locale.ROOT);
        if (!allowedExt.contains(ext)) {
            throw new IllegalArgumentException("Extension non autorisée: ." + ext);
        }
        Path dir = baseDir.resolve("users").resolve(String.valueOf(userId)).resolve(subFolder);
        Files.createDirectories(dir);
        String name = UUID.randomUUID() + "." + ext;
        Path target = dir.resolve(name);
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        return "/uploads/users/" + userId + "/" + subFolder + "/" + name;
    }

    private String extension(String filename) {
        int i = filename.lastIndexOf('.');
        if (i < 0) {
            return "";
        }
        return filename.substring(i + 1);
    }
}
