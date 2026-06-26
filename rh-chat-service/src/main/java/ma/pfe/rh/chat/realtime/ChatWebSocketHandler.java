package ma.pfe.rh.chat.realtime;

import lombok.RequiredArgsConstructor;
import ma.pfe.rh.chat.service.ChatService;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
@RequiredArgsConstructor
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private final ChatSessionRegistry registry;
    private final ChatService chatService;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        Long userId = userId(session);
        registry.add(userId, session);
        chatService.setOnline(userId, true);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        // Le frontend envoie via REST; WebSocket sert à recevoir les événements temps réel.
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Long userId = userId(session);
        registry.remove(userId, session);
        if (!registry.hasSessions(userId)) {
            chatService.setOnline(userId, false);
        }
    }

    private Long userId(WebSocketSession session) {
        Object v = session.getAttributes().get("userId");
        if (v instanceof Long id) {
            return id;
        }
        return Long.valueOf(String.valueOf(v));
    }
}
