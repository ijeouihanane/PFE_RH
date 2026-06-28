import { CommonModule, DatePipe } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideBell,
  LucideBellDot,
  LucideDownload,
  LucideFile,
  LucideInbox,
  LucideMoreHorizontal,
  LucidePaperclip,
  LucidePlus,
  LucideSearch,
  LucideSend,
  LucideSmile,
  LucideTrash2,
  LucideUsers,
} from '@lucide/angular';
import { Subscription } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { ChatConversation, ChatMessage, NotificationItem } from '../core/messaging.model';
import { MessagingService } from '../core/messaging.service';
import { Role, User } from '../core/models';

type ConversationFilter = 'ALL' | 'UNREAD' | 'EMPLOYEE' | 'MANAGER';
type MessageRow = { kind: 'date'; label: string } | { kind: 'message'; message: ChatMessage };
type EmojiCategory = 'RECENT' | 'SMILEYS' | 'WORK' | 'OBJECTS';

@Component({
  selector: 'app-messaging',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DatePipe,
    LucideBell,
    LucideBellDot,
    LucideDownload,
    LucideFile,
    LucideInbox,
    LucideMoreHorizontal,
    LucidePaperclip,
    LucidePlus,
    LucideSearch,
    LucideSend,
    LucideSmile,
    LucideTrash2,
    LucideUsers,
  ],
  templateUrl: './messaging.component.html',
  styleUrl: './messaging.component.scss',
})
export class MessagingComponent implements OnInit, OnDestroy {
  @ViewChild('messagesPanel') messagesPanel?: ElementRef<HTMLDivElement>;

  conversations: ChatConversation[] = [];
  messages: ChatMessage[] = [];
  notifications: NotificationItem[] = [];
  users: User[] = [];
  filteredConversations: ChatConversation[] = [];
  messageRows: MessageRow[] = [];
  selected?: ChatConversation;
  filter: ConversationFilter = 'ALL';
  search = '';
  newConversationOpen = false;
  selectedUserId?: number;
  draft = '';
  file?: File;
  emojiOpen = false;
  notificationsOpen = false;
  loading = true;
  emojiCategory: EmojiCategory = 'RECENT';

  readonly avatarColors = ['#10b981', '#8b5cf6', '#0ea5e9', '#f59e0b', '#6366f1', '#ef4444'];
  readonly emojiGroups: Record<EmojiCategory, string[]> = {
    RECENT: ['😀', '😊', '👍', '🙏', '✅', '📄', '📌', '💼', '⏰', '🎉', '🙂', '👌'],
    SMILEYS: ['😀', '😄', '😊', '🙂', '😉', '😍', '😅', '😎', '🤝', '👏', '👍', '🙏'],
    WORK: ['💼', '📄', '📎', '📌', '📅', '⏰', '✅', '📊', '📝', '🔔', '📣', '👥'],
    OBJECTS: ['📁', '📷', '💻', '📱', '🔒', '🔑', '🖊️', '📚', '🎯', '⭐', '⚠️', '🎉'],
  };
  private sub = new Subscription();

  constructor(
    readonly auth: AuthService,
    private readonly messaging: MessagingService,
  ) {}

  ngOnInit(): void {
    const token = this.auth.token;
    if (token) {
      this.messaging.connect(token);
    }
    this.loadConversations();
    this.loadNotifications();
    if (this.isRh) {
      this.messaging.users().subscribe((users) => {
        this.users = users.filter((u) => u.role === 'EMPLOYEE' || u.role === 'MANAGER');
      });
    }
    this.sub.add(this.messaging.events$.subscribe((event) => this.handleRealtime(event.type, event.payload)));
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.messaging.disconnect();
  }

  @HostListener('document:click', ['$event'])
  closeFloatingPanels(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.bell') && !target.closest('.notifications-popover')) {
      this.notificationsOpen = false;
    }
    if (!target.closest('.emoji-panel') && !target.closest('.emoji-trigger')) {
      this.emojiOpen = false;
    }
  }

  get isRh(): boolean {
    return this.auth.user?.role === 'RH';
  }

  get title(): string {
    return this.isRh ? 'Messagerie RH' : 'Messagerie';
  }

  get subtitle(): string {
    return this.isRh ? 'Communication interne' : 'Communication interne avec le RH';
  }

  get unreadNotifications(): number {
    // Basé sur les conversations avec messages non-lus (fiable, indépendant du backend lu-status)
    return this.conversations.filter((c) => c.unreadCount > 0).length;
  }

  get activeEmojis(): string[] {
    return this.emojiGroups[this.emojiCategory];
  }

  applyConversationFilters(): void {
    const term = this.search.trim().toLowerCase();
    this.filteredConversations = this.conversations.filter((c) => {
      const byFilter =
        this.filter === 'ALL' ||
        (this.filter === 'UNREAD' && c.unreadCount > 0) ||
        c.contactRole === this.filter;
      const bySearch = !term || c.contactName.toLowerCase().includes(term) || c.contactRole.toLowerCase().includes(term);
      return byFilter && bySearch;
    });
  }

  rebuildMessageRows(): void {
    const rows: MessageRow[] = [];
    let lastLabel = '';
    for (const message of this.messages) {
      const label = this.dateLabel(message.createdAt);
      if (label !== lastLabel) {
        rows.push({ kind: 'date', label });
        lastLabel = label;
      }
      rows.push({ kind: 'message', message });
    }
    this.messageRows = rows;
  }

  loadConversations(): void {
    this.loading = true;
    this.messaging.conversations().subscribe({
      next: (items) => {
        this.conversations = items.map((item) => {
          const current = this.conversations.find((c) => c.id === item.id);
          if (this.selected?.id === item.id) {
            return { ...item, unreadCount: 0 };
          }
          return current ? { ...item, unreadCount: Math.max(item.unreadCount, current.unreadCount) } : item;
        });
        this.applyConversationFilters();
        this.loading = false;
        // Regénérer les notifications depuis les conversations fraîchement chargées
        this.refreshNotificationsFromConversations();
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  loadNotifications(): void {
    // Synthétise les notifications depuis les conversations non-lues (source fiable)
    this.refreshNotificationsFromConversations();
  }

  private refreshNotificationsFromConversations(): void {
    // Crée une notification par conversation avec des messages non-lus
    const fromConversations: NotificationItem[] = this.conversations
      .filter((c) => c.unreadCount > 0)
      .map((c) => ({
        id: -(c.id),
        userId: this.auth.user?.id || 0,
        titre: 'Nouveau message',
        message: `${c.contactName} : ${c.lastMessagePreview || 'Message reçu'}`,
        type: 'CHAT' as const,
        lu: false,
        createdAt: c.lastMessageAt || new Date().toISOString(),
        chatConversationId: c.id,
        chatMessageId: undefined,
      }));

    // Garder les notifs locales temps-réel pour conversations pas encore rafraîchies
    const convIds = new Set(fromConversations.map((n) => n.chatConversationId));
    const pendingRealtime = this.notifications.filter((n) => n.id < 0 && !convIds.has(n.chatConversationId));

    this.notifications = [...fromConversations, ...pendingRealtime]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }

  openNotification(notification: NotificationItem): void {
    const conversationId = notification.chatConversationId || this.findConversationIdFromNotification(notification);
    if (!conversationId) {
      return;
    }
    const conversation = this.conversations.find((c) => c.id === conversationId);
    if (conversation) {
      this.selectConversation(conversation);
      this.notificationsOpen = false;
    }
  }

  selectConversation(conversation: ChatConversation): void {
    this.selected = conversation;
    this.clearConversationNotifications(conversation.id);
    this.messaging.messages(conversation.id).subscribe((items) => {
      this.messages = items;
      this.rebuildMessageRows();
      this.markRead(conversation.id);
      setTimeout(() => this.scrollBottom(), 0);
    });
  }

  createConversation(): void {
    if (!this.selectedUserId) {
      return;
    }
    this.messaging.createConversation(this.selectedUserId).subscribe((conversation) => {
      this.newConversationOpen = false;
      this.selectedUserId = undefined;
      this.upsertConversation(conversation);
      this.selectConversation(conversation);
    });
  }

  cancelNewConversation(): void {
    this.newConversationOpen = false;
    this.selectedUserId = undefined;
  }

  send(): void {
    if (!this.selected) {
      return;
    }
    if (this.file) {
      const file = this.file;
      this.file = undefined;
      this.messaging.sendAttachment(this.selected.id, file).subscribe((message) => this.upsertMessage(message));
    }
    const content = this.draft.trim();
    if (content) {
      this.draft = '';
      this.messaging.sendMessage(this.selected.id, content).subscribe((message) => this.upsertMessage(message));
    }
  }

  pickFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file = input.files?.[0];
    input.value = '';
  }

  addEmoji(emoji: string): void {
    this.draft = `${this.draft}${emoji}`;
    this.emojiOpen = false;
  }

  deleteMessage(message: ChatMessage): void {
    if (!message.mine) {
      return;
    }
    this.messaging.deleteMessage(message.id).subscribe(() => {
      this.messages = this.messages.filter((m) => m.id !== message.id);
      this.rebuildMessageRows();
      this.loadConversations();
    });
  }

  downloadFile(message: ChatMessage): void {
    if (!message.attachment) {
      return;
    }
    this.messaging.downloadAttachment(message.attachment.downloadUrl).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = message.attachment?.fileName || 'fichier';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  }

  avatarColor(seed: string | number): string {
    const value = String(seed || '');
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = value.charCodeAt(i) + ((hash << 5) - hash);
    }
    return this.avatarColors[Math.abs(hash) % this.avatarColors.length];
  }

  roleLabel(role: Role): string {
    return role === 'EMPLOYEE' ? 'Employé' : role === 'MANAGER' ? 'Manager' : role;
  }

  formatSize(size: number): string {
    if (size < 1024 * 1024) {
      return `${Math.max(1, Math.round(size / 1024))} Ko`;
    }
    return `${(size / 1024 / 1024).toFixed(1)} Mo`;
  }

  private handleRealtime(type: string, payload: any): void {
    if (type === 'MESSAGE_CREATED') {
      const message = payload as ChatMessage;
      if (this.selected?.id === message.conversationId) {
        this.upsertMessage(message);
        if (!message.mine) {
          this.markRead(message.conversationId);
        }
      }
      if (!message.mine && this.selected?.id !== message.conversationId) {
        // Bump immédiat pour le badge et la notif cloche
        this.bumpUnread(message.conversationId);
        this.refreshNotificationsFromConversations();
      }
      this.loadConversations();
    }
    if (type === 'MESSAGE_DELETED') {
      this.messages = this.messages.filter((m) => m.id !== payload.messageId);
      this.rebuildMessageRows();
      this.loadConversations();
    }
    if (type === 'CONVERSATION_READ') {
      this.messages = this.messages.map((m) =>
        m.mine && m.id <= payload.lastReadMessageId ? { ...m, readByContact: true } : m,
      );
      this.rebuildMessageRows();
      if (payload.userId !== this.auth.user?.id) {
        this.loadConversations();
      }
    }
    if (type === 'PRESENCE_CHANGED') {
      this.conversations = this.conversations.map((c) =>
        c.contactId === payload.userId
          ? { ...c, contactOnline: payload.online, contactLastSeenAt: payload.lastSeenAt }
          : c,
      );
      this.applyConversationFilters();
      if (this.selected && this.selected.contactId === payload.userId) {
        const selected: ChatConversation = this.selected;
        this.selected = { ...selected, contactOnline: payload.online, contactLastSeenAt: payload.lastSeenAt };
      }
    }
  }

  private markRead(conversationId: number): void {
    this.messaging.markRead(conversationId).subscribe(() => {
      this.conversations = this.conversations.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c));
      this.applyConversationFilters();
    });
  }

  private clearConversationNotifications(conversationId: number): void {
    const related = this.notifications.filter((n) => n.chatConversationId === conversationId && !n.lu);
    if (!related.length) {
      return;
    }
    this.notifications = this.notifications.filter((n) => n.chatConversationId !== conversationId);
    for (const notification of related) {
      if (notification.id > 0) {
        this.messaging.markNotificationRead(notification.id).subscribe();
      }
    }
  }

  private findConversationIdFromNotification(notification: NotificationItem): number | undefined {
    const titleName = notification.titre.replace('Nouveau message de ', '').trim().toLowerCase();
    return this.conversations.find((c) => c.contactName.toLowerCase() === titleName)?.id;
  }

  private upsertMessage(message: ChatMessage): void {
    const exists = this.messages.some((m) => m.id === message.id);
    this.messages = exists ? this.messages.map((m) => (m.id === message.id ? message : m)) : [...this.messages, message];
    this.rebuildMessageRows();
    setTimeout(() => this.scrollBottom(), 0);
  }


  private bumpUnread(conversationId: number): void {
    if (this.selected?.id === conversationId) {
      return;
    }
    this.conversations = this.conversations.map((c) =>
      c.id === conversationId ? { ...c, unreadCount: c.unreadCount + 1 } : c,
    );
    this.applyConversationFilters();
  }

  private upsertConversation(conversation: ChatConversation): void {
    const exists = this.conversations.some((c) => c.id === conversation.id);
    this.conversations = exists
      ? this.conversations.map((c) => (c.id === conversation.id ? conversation : c))
      : [conversation, ...this.conversations];
    this.applyConversationFilters();
  }

  setFilter(filter: ConversationFilter): void {
    this.filter = filter;
    this.applyConversationFilters();
  }

  onSearchChange(value: string): void {
    this.search = value;
    this.applyConversationFilters();
  }

  private scrollBottom(): void {
    const el = this.messagesPanel?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }

  private dateLabel(value: string): string {
    const date = new Date(value);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) {
      return 'Aujourd’hui';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Hier';
    }
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
  }
}
