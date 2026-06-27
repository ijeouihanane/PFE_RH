import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { NgFor, NgIf, DatePipe, TitleCasePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
import { AiChatResponse, AiStatus, ChatLogEntry } from '../core/chat.model';
import { AuthService } from '../core/auth.service';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  docSource?: string;
  pageNumber?: number;
  pageRange?: string;
  confidenceScore?: number;
  answered?: boolean;
  timestamp: Date;
}

interface MessageGroup {
  dateLabel: string;
  messages: ChatMessage[];
}

@Component({
  standalone: true,
  selector: 'app-chatbot',
  imports: [NgIf, NgFor, FormsModule, DatePipe, TitleCasePipe],
  template: `
    <section class="assistant-shell">
      <header class="assistant-header">
        <div>
          <h1>Assistant RH</h1>
          <p>
            <span class="trust-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z"></path>
                <path d="m9 12 2 2 4-5"></path>
              </svg>
            </span>
            Posez vos questions RH et obtenez des réponses basées sur des sources fiables validées par le service RH.
          </p>
        </div>

        <div class="availability" [class.online]="aiAvailable" [class.offline]="!aiAvailable">
          <span></span>
          {{ aiAvailable ? 'EN LIGNE' : 'HORS LIGNE' }}
        </div>
      </header>

      <main class="conversation" #messagesContainer>
        <div class="conversation-inner">
          <section class="empty-state" *ngIf="messageGroups.length === 0 && !loadingHistory">
            <div class="assistant-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M12 8V4H8"></path>
                <rect width="16" height="12" x="4" y="8" rx="2"></rect>
                <path d="M2 14h2"></path>
                <path d="M20 14h2"></path>
                <path d="M9 13v2"></path>
                <path d="M15 13v2"></path>
                <path d="M10 18h4"></path>
              </svg>
            </div>
            <h2>Bonjour, je suis votre assistant RH.</h2>
            <p>Posez-moi une question sur vos droits, obligations ou procédures internes.</p>

            <div class="suggestions">
              <button
                type="button"
                *ngFor="let item of suggestions"
                (click)="askSuggestion(item)"
                [disabled]="loading || !aiAvailable"
              >
                <span aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M12 3v4"></path>
                    <path d="M12 17v4"></path>
                    <path d="M3 12h4"></path>
                    <path d="M17 12h4"></path>
                    <path d="m7.8 7.8 2.4 2.4"></path>
                    <path d="m13.8 13.8 2.4 2.4"></path>
                    <path d="m16.2 7.8-2.4 2.4"></path>
                    <path d="m10.2 13.8-2.4 2.4"></path>
                  </svg>
                </span>
                {{ item }}
              </button>
            </div>
          </section>

          <ng-container *ngFor="let group of messageGroups">
            <div class="date-separator">
              <span>{{ group.dateLabel | titlecase }}</span>
            </div>

            <div *ngFor="let msg of group.messages" class="message-row" [class.user]="msg.role === 'user'" [class.assistant]="msg.role === 'assistant'">
              <div class="assistant-avatar" *ngIf="msg.role === 'assistant'" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M12 8V4H8"></path>
                  <rect width="16" height="12" x="4" y="8" rx="2"></rect>
                  <path d="M2 14h2"></path>
                  <path d="M20 14h2"></path>
                  <path d="M9 13v2"></path>
                  <path d="M15 13v2"></path>
                  <path d="M10 18h4"></path>
                </svg>
              </div>

              <div class="message-stack">
                <div class="message-bubble" [class.user-bubble]="msg.role === 'user'" [class.assistant-bubble]="msg.role === 'assistant'">
                  <div class="message-content">{{ msg.content }}</div>
                </div>

                <div class="source-pill" *ngIf="msg.role === 'assistant' && msg.answered !== false && msg.docSource">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <path d="M14 2v6h6"></path>
                  </svg>
                  Source : {{ msg.docSource }}
                  <span *ngIf="msg.pageRange"> — {{ msg.pageRange }}</span>
                  <span *ngIf="!msg.pageRange && msg.pageNumber"> — Page {{ msg.pageNumber }}</span>
                </div>

                <div class="message-time">{{ msg.timestamp | date:'HH:mm' }}</div>
              </div>
            </div>
          </ng-container>

          <div class="message-row assistant" *ngIf="loading">
            <div class="assistant-avatar" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M12 8V4H8"></path>
                <rect width="16" height="12" x="4" y="8" rx="2"></rect>
                <path d="M2 14h2"></path>
                <path d="M20 14h2"></path>
                <path d="M9 13v2"></path>
                <path d="M15 13v2"></path>
                <path d="M10 18h4"></path>
              </svg>
            </div>
            <div class="typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      </main>

      <footer class="composer">
        <input
          type="text"
          [(ngModel)]="question"
          (keydown.enter)="send()"
          placeholder="Poser une question sur les documents RH..."
          [disabled]="loading || !aiAvailable"
        />
        <button type="button" (click)="send()" [disabled]="loading || !question.trim() || !aiAvailable" aria-label="Envoyer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
            <path d="m22 2-7 20-4-9-9-4 20-7Z"></path>
            <path d="M22 2 11 13"></path>
          </svg>
        </button>
      </footer>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      min-height: 0;
    }

    .assistant-shell {
      height: 100%;
      min-height: 0;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      background: #ffffff;
      color: #020617;
      overflow: hidden;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .assistant-header {
      min-height: 78px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding: 18px 34px 15px;
      border-bottom: 1px solid #dfe6ef;
      background: #ffffff;
      z-index: 2;
    }

    .assistant-header h1 {
      margin: 0 0 5px;
      font-size: 18px;
      line-height: 1.2;
      font-weight: 500;
      letter-spacing: 0;
      color: #020617;
    }

    .assistant-header p {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      color: #475569;
      font-size: 12px;
      line-height: 1.4;
      font-weight: 400;
    }

    .trust-icon {
      width: 14px;
      height: 14px;
      color: #2563eb;
      display: inline-grid;
      place-items: center;
      flex: 0 0 auto;
    }

    .trust-icon svg,
    .availability svg,
    .assistant-mark svg,
    .suggestions svg,
    .assistant-avatar svg,
    .source-pill svg,
    .composer svg {
      width: 100%;
      height: 100%;
    }

    .availability {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 30px;
      padding: 0 14px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .availability span {
      width: 9px;
      height: 9px;
      border-radius: 999px;
      display: block;
    }

    .availability.online {
      color: #059669;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
    }

    .availability.online span {
      background: #10b981;
      box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.13);
      animation: pulseOnline 1.8s ease-in-out infinite;
    }

    .availability.offline {
      color: #dc2626;
      background: #fef2f2;
      border: 1px solid #fecaca;
    }

    .availability.offline span {
      background: #ef4444;
    }

    @keyframes pulseOnline {
      0%, 100% { box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.14); }
      50% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0.06); }
    }

    .conversation {
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      scrollbar-width: none;
      background: #ffffff;
      scroll-behavior: smooth;
    }

    .conversation::-webkit-scrollbar {
      display: none;
    }

    .conversation-inner {
      min-height: 100%;
      padding: 26px 42px 36px;
      position: relative;
    }

    .empty-state {
      min-height: calc(100vh - 232px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      color: #475569;
      transform: translateY(-12px);
    }

    .assistant-mark {
      width: 56px;
      height: 56px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      color: #2563eb;
      background: #f1f5f9;
      border: 4px solid #e8eef7;
      margin-bottom: 20px;
    }

    .assistant-mark svg {
      width: 25px;
      height: 25px;
    }

    .empty-state h2 {
      margin: 0 0 9px;
      color: #020617;
      font-size: 16px;
      font-weight: 500;
      line-height: 1.3;
      letter-spacing: 0;
    }

    .empty-state p {
      margin: 0 0 26px;
      color: #475569;
      font-size: 13px;
      line-height: 1.5;
      font-weight: 400;
    }

    .suggestions {
      width: min(672px, 100%);
      display: grid;
      gap: 9px;
    }

    .suggestions button {
      width: 100%;
      min-height: 45px;
      display: flex;
      align-items: center;
      gap: 13px;
      border: 1px solid #dbe3ef;
      background: #ffffff;
      color: #020617;
      border-radius: 8px;
      padding: 0 17px;
      text-align: left;
      cursor: pointer;
      font-size: 13px;
      font-weight: 400;
      line-height: 1.35;
      transition: border-color 0.18s ease, box-shadow 0.18s ease, color 0.18s ease;
    }

    .suggestions button span {
      width: 17px;
      height: 17px;
      color: #64748b;
      flex: 0 0 auto;
    }

    .suggestions button:hover:not(:disabled) {
      border-color: #b9c8dc;
      color: #1d4ed8;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
    }

    .suggestions button:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .date-separator {
      display: flex;
      justify-content: center;
      margin: 2px 0 20px;
    }

    .date-separator span {
      min-height: 26px;
      display: inline-flex;
      align-items: center;
      padding: 0 14px;
      border-radius: 999px;
      border: 1px solid #dbe3ef;
      background: #ffffff;
      color: #64748b;
      font-size: 11px;
      line-height: 1;
      font-weight: 500;
      letter-spacing: 0.35px;
      text-transform: uppercase;
    }

    .message-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin: 0 0 20px;
    }

    .message-row.user {
      justify-content: flex-end;
      padding-left: 28%;
    }

    .message-row.assistant {
      justify-content: flex-start;
      padding-right: 18%;
    }

    .assistant-avatar {
      width: 34px;
      height: 34px;
      margin-top: 1px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      color: #2563eb;
      background: #edf4ff;
      border: 1px solid #cfe0fb;
    }

    .assistant-avatar svg {
      width: 17px;
      height: 17px;
    }

    .message-stack {
      max-width: 820px;
      min-width: 0;
    }

    .message-row.user .message-stack {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    .message-bubble {
      border-radius: 12px;
      padding: 13px 16px;
      line-height: 1.55;
      font-size: 13px;
      font-weight: 400;
      letter-spacing: 0;
      word-break: break-word;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
    }

    .user-bubble {
      background: #1557c9;
      color: #ffffff;
      border: 1px solid #1557c9;
      border-radius: 10px;
      box-shadow: 0 2px 5px rgba(21, 87, 201, 0.18);
    }

    .assistant-bubble {
      background: #ffffff;
      color: #020617;
      border: 1px solid #dbe3ef;
      min-width: min(680px, 100%);
    }

    .message-content {
      white-space: pre-wrap;
    }

    .source-pill {
      width: fit-content;
      max-width: 100%;
      min-height: 30px;
      margin-top: 8px;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 0 10px;
      border-radius: 7px;
      border: 1px solid #b8cff9;
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 12px;
      font-weight: 500;
      line-height: 1.25;
    }

    .source-pill svg {
      width: 14px;
      height: 14px;
      flex: 0 0 auto;
    }

    .message-time {
      margin-top: 6px;
      color: #64748b;
      font-size: 11px;
      line-height: 1;
      font-weight: 400;
    }

    .typing {
      height: 36px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 0 14px;
      border-radius: 10px;
      border: 1px solid #dbe3ef;
      background: #ffffff;
    }

    .typing span {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: #94a3b8;
      animation: blink 1.3s infinite both;
    }

    .typing span:nth-child(2) { animation-delay: 0.16s; }
    .typing span:nth-child(3) { animation-delay: 0.32s; }

    @keyframes blink {
      0%, 80%, 100% { opacity: 0.28; transform: translateY(0); }
      40% { opacity: 1; transform: translateY(-2px); }
    }

    .composer {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 42px;
      gap: 9px;
      align-items: center;
      padding: 13px 40px 12px;
      border-top: 1px solid #dfe6ef;
      background: #ffffff;
      z-index: 2;
    }

    .composer input {
      width: 100%;
      height: 42px;
      border: 1px solid #dbe3ef;
      border-radius: 8px;
      padding: 0 16px;
      outline: none;
      color: #0f172a;
      background: #ffffff;
      font-size: 13px;
      font-weight: 400;
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
    }

    .composer input::placeholder {
      color: #64748b;
    }

    .composer input:focus {
      border-color: #93b4ee;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
    }

    .composer input:disabled {
      background: #f8fafc;
      cursor: not-allowed;
    }

    .composer button {
      width: 42px;
      height: 42px;
      border: none;
      border-radius: 10px;
      display: grid;
      place-items: center;
      cursor: pointer;
      color: #ffffff;
      background: #2563eb;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.28);
      transition: background 0.18s ease, box-shadow 0.18s ease, transform 0.15s ease;
    }

    .composer button svg {
      width: 18px;
      height: 18px;
    }

    .composer button:hover:not(:disabled) {
      background: #1d4ed8;
      box-shadow: 0 4px 16px rgba(37, 99, 235, 0.38);
      transform: translateY(-1px);
    }

    .composer button:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: 0 1px 4px rgba(37, 99, 235, 0.2);
    }

    .composer button:disabled {
      background: #93b4f5;
      box-shadow: none;
      cursor: not-allowed;
      transform: none;
    }

    @media (max-width: 900px) {
      .assistant-header,
      .composer {
        padding-left: 20px;
        padding-right: 20px;
      }

      .conversation-inner {
        padding-left: 20px;
        padding-right: 20px;
      }

      .message-row.user,
      .message-row.assistant {
        padding-left: 0;
        padding-right: 0;
      }

      .assistant-bubble {
        min-width: 0;
      }
    }
  `],
})
export class ChatbotComponent implements OnInit, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  allMessages: ChatMessage[] = [];
  messageGroups: MessageGroup[] = [];

  question = '';
  loading = false;
  loadingHistory = true;
  aiAvailable = false;
  userName = '';
  readonly suggestions = [
    'Quelles sont les conditions pour devenir délégué du personnel ?',
    'Quels sont les jours fériés payés ?',
    'Quelles sont les obligations générales d’un employé ?',
  ];

  private readonly API = `${environment.apiUrl}/api/documents/ai`;
  private shouldScroll = false;

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
  ) { }

  ngOnInit(): void {
    this.userName = this.auth.user?.prenom ?? 'Utilisateur';
    this.checkStatus();
    this.loadHistory();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  checkStatus(): void {
    this.http.get<AiStatus>(`${this.API}/status`).subscribe({
      next: s => this.aiAvailable = s.available,
      error: () => this.aiAvailable = false,
    });
  }

  loadHistory(): void {
    this.loadingHistory = true;
    this.http.get<ChatLogEntry[]>(`${this.API}/chat/history`).subscribe({
      next: logs => {
        const chronological = logs.reverse();

        const rawMsgs: ChatMessage[] = [];
        for (const entry of chronological) {
          rawMsgs.push({
            role: 'user',
            content: entry.question,
            timestamp: new Date(entry.createdAt)
          });
          rawMsgs.push({
            role: 'assistant',
            content: entry.answer,
            docSource: entry.docSource,
            pageNumber: entry.pageNumber,
            pageRange: entry.pageRange,
            answered: entry.answered,
            timestamp: new Date(entry.createdAt)
          });
        }

        this.allMessages = rawMsgs;
        this.rebuildGroups();
        this.loadingHistory = false;
        setTimeout(() => this.scrollToBottom(), 100);
      },
      error: () => {
        this.allMessages = [];
        this.loadingHistory = false;
      },
    });
  }

  askSuggestion(value: string): void {
    if (this.loading || !this.aiAvailable) return;
    this.question = value;
    this.send();
  }

  private rebuildGroups(): void {
    const groupsMap = new Map<string, ChatMessage[]>();

    for (const msg of this.allMessages) {
      const d = new Date(msg.timestamp);
      d.setHours(0, 0, 0, 0);
      const key = d.getTime().toString();

      if (!groupsMap.has(key)) {
        groupsMap.set(key, []);
      }
      groupsMap.get(key)!.push(msg);
    }

    const sortedKeys = Array.from(groupsMap.keys()).sort((a, b) => parseInt(a) - parseInt(b));

    this.messageGroups = sortedKeys.map(key => {
      const dateObj = new Date(parseInt(key));
      return {
        dateLabel: this.formatDateLabel(dateObj),
        messages: groupsMap.get(key)!
      };
    });
  }

  private formatDateLabel(d: Date): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const targetTime = d.getTime();

    if (targetTime === today.getTime()) return "Aujourd'hui";
    if (targetTime === yesterday.getTime()) return "Hier";

    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  send(): void {
    const q = this.question?.trim();
    if (!q || this.loading) return;

    const userMsg: ChatMessage = { role: 'user', content: q, timestamp: new Date() };
    this.allMessages.push(userMsg);
    this.rebuildGroups();

    this.question = '';
    this.loading = true;
    this.shouldScroll = true;

    this.http.post<AiChatResponse>(`${this.API}/chat`, { question: q }).subscribe({
      next: resp => {
        this.allMessages.push({
          role: 'assistant',
          content: resp.answer,
          docSource: resp.docSource,
          pageNumber: resp.pageNumber,
          pageRange: resp.pageRange,
          confidenceScore: resp.confidenceScore,
          answered: resp.answered,
          timestamp: new Date(),
        });
        this.rebuildGroups();
        this.loading = false;
        this.shouldScroll = true;
      },
      error: err => {
        this.allMessages.push({
          role: 'assistant',
          content: err?.error?.error ?? 'Une erreur est survenue. Veuillez réessayer.',
          answered: false,
          timestamp: new Date(),
        });
        this.rebuildGroups();
        this.loading = false;
        this.shouldScroll = true;
      },
    });
  }

  private scrollToBottom(): void {
    try {
      const el = this.messagesContainer?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    } catch { }
  }
}
