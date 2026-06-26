import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { ChatConversation, ChatMessage, ChatRealtimeEvent, NotificationItem } from './messaging.model';
import { User } from './models';

@Injectable({ providedIn: 'root' })
export class MessagingService {
  private socket?: WebSocket;
  private readonly eventsSubject = new Subject<ChatRealtimeEvent>();
  readonly events$ = this.eventsSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  conversations(): Observable<ChatConversation[]> {
    return this.http.get<ChatConversation[]>(`${environment.apiUrl}/api/chat/conversations`);
  }

  createConversation(recipientId: number): Observable<ChatConversation> {
    return this.http.post<ChatConversation>(`${environment.apiUrl}/api/chat/conversations`, { recipientId });
  }

  messages(conversationId: number): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`${environment.apiUrl}/api/chat/conversations/${conversationId}/messages`);
  }

  sendMessage(conversationId: number, content: string): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${environment.apiUrl}/api/chat/conversations/${conversationId}/messages`, { content });
  }

  sendAttachment(conversationId: number, file: File): Observable<ChatMessage> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ChatMessage>(`${environment.apiUrl}/api/chat/conversations/${conversationId}/attachments`, form);
  }

  markRead(conversationId: number): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/api/chat/conversations/${conversationId}/read`, {});
  }

  deleteMessage(messageId: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/api/chat/messages/${messageId}`);
  }

  downloadAttachment(downloadUrl: string): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}${downloadUrl}`, { responseType: 'blob' });
  }

  notifications(): Observable<NotificationItem[]> {
    return this.http.get<NotificationItem[]>(`${environment.apiUrl}/api/notifications/me`);
  }

  markNotificationRead(id: number): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/api/notifications/${id}/read`, {});
  }

  users(): Observable<User[]> {
    return this.http.get<User[]>(`${environment.apiUrl}/api/users`);
  }

  connect(token: string): void {
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) {
      return;
    }
    const wsBase = environment.apiUrl.replace(/^http/, 'ws');
    this.socket = new WebSocket(`${wsBase}/ws/chat?token=${encodeURIComponent(token)}`);
    this.socket.onmessage = (event) => {
      try {
        this.eventsSubject.next(JSON.parse(event.data) as ChatRealtimeEvent);
      } catch {
        // Ignore malformed realtime messages.
      }
    };
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = undefined;
  }
}
