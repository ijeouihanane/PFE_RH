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
public class PayrollFileStorage {

    private final Path baseDir;

    public PayrollFileStorage(@Value("${app.uploads.dir}") String dir) {
        this.baseDir = Path.of(dir).toAbsolutePath().normalize();
    }

    public String storePayslip(Long employeeId, int mois, int annee, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Fichier vide");
        }
        String original = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
        String ext = extension(original).toLowerCase(Locale.ROOT);
        if (!Set.of("pdf").contains(ext)) {
            throw new IllegalArgumentException("Seuls les PDF sont acceptés");
        }
        Path dir = baseDir.resolve("payslips").resolve(String.valueOf(employeeId)).resolve(annee + "-" + mois);
        Files.createDirectories(dir);
        String name = UUID.randomUUID() + ".pdf";
        Path target = dir.resolve(name);
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        return "/uploads/payslips/" + employeeId + "/" + annee + "-" + mois + "/" + name;
    }

    public String storePdfBytes(Long employeeId, int mois, int annee, byte[] pdfBytes) throws IOException {
        Path dir = baseDir.resolve("payslips").resolve(String.valueOf(employeeId)).resolve(annee + "-" + mois);
        Files.createDirectories(dir);
        String name = "bulletin-" + UUID.randomUUID() + ".pdf";
        Path target = dir.resolve(name);
        Files.write(target, pdfBytes);
        return "/uploads/payslips/" + employeeId + "/" + annee + "-" + mois + "/" + name;
    }

    private String extension(String filename) {
        int i = filename.lastIndexOf('.');
        if (i < 0) {
            return "";
        }
        return filename.substring(i + 1);
    }
}
