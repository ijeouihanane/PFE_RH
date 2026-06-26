package ma.pfe.rh.notifications.kafka;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import ma.pfe.rh.notifications.domain.NotificationType;
import ma.pfe.rh.notifications.integration.UserDirectory;
import ma.pfe.rh.notifications.service.EmailService;
import ma.pfe.rh.notifications.service.NotificationService;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class NotificationEventsListener {

    public static final String T_ACCOUNT_CREATED = "account.created";
    public static final String T_PROFILE_CREATED = "profile.created";
    public static final String T_LEAVE_REQUESTED = "leave.requested";
    public static final String T_LEAVE_MANAGER_APPROVED = "leave.manager.approved";
    public static final String T_LEAVE_APPROVED = "leave.approved";
    public static final String T_LEAVE_REJECTED = "leave.rejected";
    public static final String T_TIMESHEET_SUBMITTED = "timesheet.submitted";
    public static final String T_TIMESHEET_APPROVED = "timesheet.approved";
    public static final String T_TIMESHEET_REJECTED = "timesheet.rejected";
    public static final String T_TIMESHEET_REMINDER = "timesheet.reminder";
    public static final String T_DOCUMENT_PUBLISHED = "document.published";
    public static final String T_DOCUMENT_REQUESTED = "document.requested";
    public static final String T_DOCUMENT_REQUEST_READY = "document.request.ready";
    public static final String T_DOCUMENT_REQUEST_REFUSED = "document.request.refused";
    public static final String T_PAYSLIP_UPLOADED = "payslip.uploaded";
    public static final String T_PAYSLIP_SENT = "payslip.sent";
    public static final String T_CHAT_MESSAGE_CREATED = "chat.message.created";

    private final ObjectMapper objectMapper;
    private final NotificationService notificationService;
    private final UserDirectory userDirectory;
    private final EmailService emailService;

    @KafkaListener(topics = {
            T_ACCOUNT_CREATED,
            T_PROFILE_CREATED,
            T_LEAVE_REQUESTED,
            T_LEAVE_MANAGER_APPROVED,
            T_LEAVE_APPROVED,
            T_LEAVE_REJECTED,
            T_TIMESHEET_SUBMITTED,
            T_TIMESHEET_APPROVED,
            T_TIMESHEET_REJECTED,
            T_TIMESHEET_REMINDER,
            T_DOCUMENT_PUBLISHED,
            T_DOCUMENT_REQUESTED,
            T_DOCUMENT_REQUEST_READY,
            T_DOCUMENT_REQUEST_REFUSED,
            T_PAYSLIP_UPLOADED,
            T_PAYSLIP_SENT,
            T_CHAT_MESSAGE_CREATED
    })
    public void consume(@Payload String payload, @Header(KafkaHeaders.RECEIVED_TOPIC) String topic) {
        try {
            JsonNode n = objectMapper.readTree(payload);
            switch (topic) {
                case T_ACCOUNT_CREATED -> handleAccountCreated(n);
                case T_PROFILE_CREATED -> handleProfileCreated(n);
                case T_LEAVE_REQUESTED -> handleLeaveRequested(n);
                case T_LEAVE_MANAGER_APPROVED -> handleLeaveManagerApproved(n);
                case T_LEAVE_APPROVED -> handleLeaveApproved(n);
                case T_LEAVE_REJECTED -> handleLeaveRejected(n);
                case T_TIMESHEET_SUBMITTED -> handleTimesheetSubmitted(n);
                case T_TIMESHEET_APPROVED -> handleTimesheetApproved(n);
                case T_TIMESHEET_REJECTED -> handleTimesheetRejected(n);
                case T_TIMESHEET_REMINDER -> handleTimesheetReminder(n);
                case T_DOCUMENT_PUBLISHED -> handleDocumentPublished(n);
                case T_DOCUMENT_REQUESTED -> handleDocumentRequested(n);
                case T_DOCUMENT_REQUEST_READY -> handleDocumentRequestReady(n);
                case T_DOCUMENT_REQUEST_REFUSED -> handleDocumentRequestRefused(n);
                case T_PAYSLIP_UPLOADED -> handlePayslipUploaded(n);
                case T_PAYSLIP_SENT -> handlePayslipSent(n);
                case T_CHAT_MESSAGE_CREATED -> handleChatMessageCreated(n);
                default -> {}
            }
        } catch (Exception ignored) {
        }
    }

    private void handleAccountCreated(JsonNode n) {
        long employeeId = n.get("employeeId").asLong();
        String email = n.get("email").asText();
        String action = n.has("action") ? n.get("action").asText() : "CREATE";
        boolean reset = "RESET".equalsIgnoreCase(action);
        boolean emailSent = emailService.sendTemporaryPassword(email, n.get("temporaryPassword").asText(), reset);
        String employeeName = displayName(employeeId);

        notificationService.notifyMany(
                userDirectory.findActiveRhUserIds(),
                reset ? "Mot de passe compte réinitialisé" : "Compte collaborateur activé",
                (reset ? "Un nouveau mot de passe temporaire a été envoyé à " : "Les accès ont été envoyés à ")
                        + employeeName + " (" + email + ")."
                        + (emailSent ? "" : " Attention : l'envoi email SMTP a échoué."),
                NotificationType.COMPTE
        );
    }

    private void handleProfileCreated(JsonNode n) {
        long employeeId = n.get("employeeId").asLong();
        String employeeName = displayName(employeeId);
        String email = n.has("email") ? n.get("email").asText() : "";
        notificationService.notifyMany(
                userDirectory.findActiveAdminUserIds(),
                "Nouveau profil à activer",
                "Un profil collaborateur a été créé par RH et attend l'activation du compte : "
                        + employeeName + (email.isBlank() ? "." : " (" + email + ")."),
                NotificationType.COMPTE
        );
    }

    private void handleLeaveRequested(JsonNode n) {
        long employeeId = n.get("employeeId").asLong();
        String employeeName = displayName(employeeId);
        notificationService.notifyUser(
                n.get("managerId").asLong(),
                "Nouvelle demande de congé",
                employeeName + " a soumis une demande de congé.",
                NotificationType.CONGE
        );
    }

    private void handleLeaveManagerApproved(JsonNode n) {
        long employeeId = n.get("employeeId").asLong();
        notificationService.notifyMany(
                userDirectory.findActiveRhUserIds(),
                "Congé à valider (RH)",
                "La demande de congé de " + displayName(employeeId) + " attend la validation RH.",
                NotificationType.CONGE
        );
    }

    private void handleLeaveApproved(JsonNode n) {
        notificationService.notifyUser(
                n.get("employeeId").asLong(),
                "Congé approuvé",
                "Votre demande de congé a été approuvée.",
                NotificationType.CONGE
        );
    }

    private void handleLeaveRejected(JsonNode n) {
        String by = n.has("by") ? n.get("by").asText() : "";
        notificationService.notifyUser(
                n.get("employeeId").asLong(),
                "Congé refusé",
                "Votre demande de congé a été refusée" + (by.isBlank() ? "." : " par " + by + "."),
                NotificationType.CONGE
        );
    }

    private void handleTimesheetSubmitted(JsonNode n) {
        long recipientId = n.has("recipientId") ? n.get("recipientId").asLong() : n.get("managerId").asLong();
        long employeeId = n.get("employeeId").asLong();
        String week = weekLabel(n);
        notificationService.notifyUser(
                recipientId,
                "Feuille de temps à valider",
                displayName(employeeId) + " a soumis sa feuille de temps " + week + ".",
                NotificationType.TIMESHEET
        );
    }

    private void handleTimesheetApproved(JsonNode n) {
        String week = weekLabel(n);
        notificationService.notifyUser(
                n.get("employeeId").asLong(),
                "Feuille de temps validée",
                "Votre feuille de temps " + week + " a été validée.",
                NotificationType.TIMESHEET
        );
    }

    private void handleTimesheetRejected(JsonNode n) {
        String week = weekLabel(n);
        notificationService.notifyUser(
                n.get("employeeId").asLong(),
                "Feuille de temps refusée",
                "Votre feuille de temps " + week + " a été refusée. Veuillez consulter le commentaire.",
                NotificationType.TIMESHEET
        );
    }

    private void handleTimesheetReminder(JsonNode n) {
        long recipientId = n.get("recipientId").asLong();
        String week = weekLabel(n);
        notificationService.notifyUser(
                recipientId,
                "Relance feuille de temps",
                "La feuille de temps " + week + " n'a pas encore été soumise.",
                NotificationType.TIMESHEET
        );
    }

    private void handleDocumentPublished(JsonNode n) {
        String titre = n.has("titre") ? n.get("titre").asText() : "Document";
        String docType = n.has("type") ? n.get("type").asText() : "DOCUMENT";
        NotificationType nt = "ANNONCE".equalsIgnoreCase(docType) ? NotificationType.ANNONCE : NotificationType.DOCUMENT;
        notificationService.notifyMany(
                userDirectory.findActiveEmployeeAndManagerIds(),
                "Nouvelle publication",
                "Un document a été publié : " + titre,
                nt
        );
    }

    private void handleDocumentRequested(JsonNode n) {
        long employeeId = n.get("employeeId").asLong();
        notificationService.notifyMany(
                userDirectory.findActiveRhUserIds(),
                "Nouvelle demande de document",
                displayName(employeeId) + " a soumis une demande : " + documentTypeLabel(n),
                NotificationType.DOCUMENT
        );
    }

    private void handleDocumentRequestReady(JsonNode n) {
        notificationService.notifyUser(
                n.get("employeeId").asLong(),
                "Document prêt",
                "Votre document est prêt : " + documentTypeLabel(n) + ".",
                NotificationType.DOCUMENT
        );
    }

    private void handleDocumentRequestRefused(JsonNode n) {
        notificationService.notifyUser(
                n.get("employeeId").asLong(),
                "Demande de document refusée",
                "Votre demande a été refusée : " + documentTypeLabel(n) + ".",
                NotificationType.DOCUMENT
        );
    }

    private void handlePayslipUploaded(JsonNode n) {
        notificationService.notifyUser(
                n.get("employeeId").asLong(),
                "Nouvelle fiche de paie",
                "Votre fiche de paie " + n.get("mois").asInt() + "/" + n.get("annee").asInt() + " est disponible.",
                NotificationType.PAIE
        );
    }

    private void handlePayslipSent(JsonNode n) {
        String mois = String.format("%02d", n.get("mois").asInt());
        notificationService.notifyUser(
                n.get("employeeId").asLong(),
                "Bulletin de paie disponible",
                "Votre bulletin de paie " + mois + "/" + n.get("annee").asInt() + " est disponible.",
                NotificationType.PAIE
        );
    }

    private void handleChatMessageCreated(JsonNode n) {
        String senderName = n.has("senderName") ? n.get("senderName").asText() : "RH";
        String preview = n.has("messagePreview") ? n.get("messagePreview").asText() : "";
        notificationService.notifyChatMessage(
                n.get("recipientId").asLong(),
                "Nouveau message",
                senderName + " vous a envoyé un message" + (preview.isBlank() ? "." : " : " + preview),
                n.get("conversationId").asLong(),
                n.get("messageId").asLong()
        );
    }

    private String displayName(long userId) {
        return userDirectory.findDisplayName(userId).orElse("Utilisateur #" + userId);
    }

    private String documentTypeLabel(JsonNode n) {
        if (!n.has("typeDoc")) return "Document";
        return switch (n.get("typeDoc").asText()) {
            case "ATTESTATION_TRAVAIL" -> "Attestation de travail";
            case "ATTESTATION_SALAIRE" -> "Attestation de salaire";
            case "FICHE_PAIE" -> "Fiche de paie";
            case "ATTESTATION_CNSS" -> "Attestation CNSS";
            case "AUTRE" -> "Autre";
            default -> n.get("typeDoc").asText();
        };
    }

    /**
     * Construit un label lisible pour la semaine, ex: "S25 (15/06 → 19/06)".
     * Utilise le champ "week" du payload Kafka (format ISO: 2026-06-15).
     */
    private String weekLabel(JsonNode n) {
        if (!n.has("week")) return "";
        try {
            java.time.LocalDate monday = java.time.LocalDate.parse(n.get("week").asText());
            java.time.LocalDate friday = monday.plusDays(4);
            int weekNum = monday.get(java.time.temporal.IsoFields.WEEK_OF_WEEK_BASED_YEAR);
            String fmt = "S%d (%s → %s)";
            java.time.format.DateTimeFormatter d = java.time.format.DateTimeFormatter.ofPattern("dd/MM");
            return String.format(fmt, weekNum, monday.format(d), friday.format(d));
        } catch (Exception e) {
            return n.get("week").asText();
        }
    }
}
