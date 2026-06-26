package ma.pfe.rh.chat.web;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import ma.pfe.rh.chat.dto.ConversationResponse;
import ma.pfe.rh.chat.dto.CreateConversationRequest;
import ma.pfe.rh.chat.dto.MessageResponse;
import ma.pfe.rh.chat.dto.SendMessageRequest;
import ma.pfe.rh.chat.service.ChatService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    @GetMapping(value = "/conversations", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<ConversationResponse> conversations(HttpServletRequest http) {
        return chatService.conversations(GatewayHeaders.requireUserId(http), GatewayHeaders.requireRole(http));
    }

    @PostMapping(value = "/conversations", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ConversationResponse createConversation(HttpServletRequest http, @RequestBody CreateConversationRequest request) {
        return chatService.createConversation(
                GatewayHeaders.requireUserId(http),
                GatewayHeaders.requireRole(http),
                request.recipientId()
        );
    }

    @GetMapping(value = "/conversations/{id}/messages", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<MessageResponse> messages(HttpServletRequest http, @PathVariable Long id) {
        return chatService.messages(GatewayHeaders.requireUserId(http), id);
    }

    @PostMapping(value = "/conversations/{id}/messages", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public MessageResponse sendMessage(HttpServletRequest http, @PathVariable Long id, @RequestBody SendMessageRequest request) {
        return chatService.sendMessage(
                GatewayHeaders.requireUserId(http),
                GatewayHeaders.requireRole(http),
                id,
                request.content()
        );
    }

    @PostMapping(value = "/conversations/{id}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public MessageResponse sendAttachment(HttpServletRequest http, @PathVariable Long id, @RequestParam("file") MultipartFile file) throws Exception {
        return chatService.sendAttachment(
                GatewayHeaders.requireUserId(http),
                GatewayHeaders.requireRole(http),
                id,
                file
        );
    }

    @PostMapping("/conversations/{id}/read")
    public void markRead(HttpServletRequest http, @PathVariable Long id) {
        chatService.markRead(GatewayHeaders.requireUserId(http), id);
    }

    @DeleteMapping("/messages/{id}")
    public void deleteMessage(HttpServletRequest http, @PathVariable Long id) {
        chatService.deleteMessage(GatewayHeaders.requireUserId(http), id);
    }

    @GetMapping("/attachments/{id}/download")
    public ResponseEntity<?> download(HttpServletRequest http, @PathVariable Long id) {
        ChatService.DownloadFile file = chatService.downloadAttachment(GatewayHeaders.requireUserId(http), id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file.fileName() + "\"")
                .contentType(MediaType.parseMediaType(file.fileType() == null ? MediaType.APPLICATION_OCTET_STREAM_VALUE : file.fileType()))
                .body(file.resource());
    }
}
