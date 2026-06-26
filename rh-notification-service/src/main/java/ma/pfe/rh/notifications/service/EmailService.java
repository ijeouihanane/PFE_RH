package ma.pfe.rh.notifications.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.mail.enabled:true}")
    private boolean enabled;

    @Value("${app.mail.from:}")
    private String from;

    @Value("${spring.mail.username:}")
    private String username;

    public boolean sendTemporaryPassword(String to, String temporaryPassword, boolean reset) {
        if (!enabled || username == null || username.isBlank()) {
            log.warn("Email sending skipped: SMTP username is not configured");
            return false;
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom((from == null || from.isBlank()) ? username : from);
            message.setTo(to);
            message.setSubject(reset ? "TechCorp - Nouveau mot de passe temporaire" : "TechCorp - Vos accès SIRH");
            message.setText(body(temporaryPassword, reset));
            mailSender.send(message);
            return true;
        } catch (MailException ex) {
            log.error("Failed to send account email to {}", to, ex);
            return false;
        }
    }

    private static String body(String temporaryPassword, boolean reset) {
        String intro = reset
                ? "Votre mot de passe SIRH TechCorp a été réinitialisé."
                : "Votre compte SIRH TechCorp a été activé.";
        return intro + "\n\n"
                + "Mot de passe temporaire: " + temporaryPassword + "\n\n"
                + "Connectez-vous avec votre email professionnel, puis changez ce mot de passe lors de la première connexion.\n\n"
                + "Si vous n'êtes pas à l'origine de cette demande, contactez le service RH.";
    }
}
