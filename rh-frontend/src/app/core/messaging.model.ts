import { Role } from './models';

export type ChatMessageType = 'TEXT' | 'FILE';

export interface ChatAttachment {
  id: number;
  fileName: string;
  fileType?: string | null;
  fileSize: number;
  downloadUrl: string;
}

export interface ChatMessage {
  id: number;
  conversationId: number;
  senderId: number;
  content: string;
  messageType: ChatMessageType;
  createdAt: string;
  mine: boolean;
  readByContact: boolean;
  attachment?: ChatAttachment | null;
  menuOpen?: boolean;
}

export interface ChatConversation {
  id: number;
  contactId: number;
  contactName: string;
  contactRole: Role;
  contactPhotoUrl?: string | null;
  contactOnline: boolean;
  contactLastSeenAt?: string | null;
  lastMessagePreview: string;
  lastMessageAt?: string | null;
  unreadCount: number;
}

export interface ChatRealtimeEvent {
  type: 'MESSAGE_CREATED' | 'MESSAGE_DELETED' | 'CONVERSATION_READ' | 'PRESENCE_CHANGED';
  payload: any;
}

export interface NotificationItem {
  id: number;
  userId: number;
  titre: string;
  message: string;
  type: string;
  lu: boolean;
  createdAt: string;
  chatConversationId?: number | null;
  chatMessageId?: number | null;
}
