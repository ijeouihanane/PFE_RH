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
    <div class="chat-wrapper">

      <!-- Header fixe en haut -->
      <header class="chat-header">
        <div class="chat-center-container header-content">
          <div class="chat-title">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Assistant RH
          </div>
          <div class="ai-status" [class.online]="aiAvailable" [class.offline]="!aiAvailable">
            <span class="status-dot"></span>
            {{ aiAvailable ? 'En ligne' : 'Hors ligne' }}
          </div>
        </div>
      </header>

      <!-- Zone de scroll des messages -->
      <main class="chat-scroll-area" #messagesContainer>
        <div class="chat-center-container">
          
          <!-- Message de Bienvenue (si vide) -->
          <div class="welcome-msg" *ngIf="messageGroups.length === 0 && !loadingHistory">
            <div class="welcome-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"/>
                <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                <line x1="9" y1="9" x2="9.01" y2="9"/>
                <line x1="15" y1="9" x2="15.01" y2="9"/>
              </svg>
            </div>
            <h3>Bonjour, {{ userName }} !</h3>
            <p>Posez-moi vos questions sur le règlement interne, les congés,<br> ou tout autre document RH publié par l'entreprise.</p>
          </div>

          <!-- Groupes de messages par date -->
          <ng-container *ngFor="let group of messageGroups">
            
            <!-- Séparateur de Date (ex: "Aujourd'hui", "Hier") -->
            <div class="date-separator">
              <span>{{ group.dateLabel | titlecase }}</span>
            </div>

            <!-- Bulles de messages -->
            <div *ngFor="let msg of group.messages" class="msg-row" [class.user]="msg.role === 'user'" [class.bot]="msg.role === 'assistant'">
              <div class="msg-bubble" [class.user-bubble]="msg.role === 'user'" [class.bot-bubble]="msg.role === 'assistant'">
                
                <div class="msg-content">{{ msg.content }}</div>

                <!-- Badge Source -->
                <div class="source-badge" *ngIf="msg.answered !== false && msg.docSource">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  {{ msg.docSource }} <span *ngIf="msg.pageRange"> — {{ msg.pageRange }}</span><span *ngIf="!msg.pageRange && msg.pageNumber"> — Page {{ msg.pageNumber }}</span>
                </div>

                <!-- Badge Non Trouvé -->
                <div class="not-found-badge" *ngIf="msg.role === 'assistant' && msg.answered === false">
                  ⚠ Information non disponible dans les documents RH
                </div>

                <!-- Heure DANS la bulle -->
                <div class="msg-time">{{ msg.timestamp | date:'HH:mm' }}</div>
              </div>
            </div>
          </ng-container>

          <!-- Loader de frappe (Typing indicator) -->
          <div class="msg-row bot" *ngIf="loading">
            <div class="msg-bubble bot-bubble typing-bubble">
              <div class="typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>

        </div>
      </main>

      <!-- Input fixe en bas -->
      <footer class="chat-input-area">
        <div class="chat-center-container">
          <div class="offline-warning" *ngIf="!aiAvailable">
            Le service d'Intelligence Artificielle est temporairement indisponible.
          </div>
          <div class="input-row">
            <input
              type="text"
              [(ngModel)]="question"
              (keydown.enter)="send()"
              placeholder="Écrivez un message..."
              [disabled]="loading || !aiAvailable"
              class="chat-input"
            />
            <button class="send-btn" (click)="send()" [disabled]="loading || !question.trim() || !aiAvailable">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      </footer>

    </div>
  `,
  styles: [`
    /* ─── Layout Global ─── */
    .chat-wrapper {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 36px); 
      margin: -18px; 
      background: #efeae2; /* Couleur de fond classique WhatsApp Web */
      position: relative;
    }

    /* Conteneur central (100% de la largeur avec du padding) */
    .chat-center-container {
      max-width: 100%;
      margin: 0 auto;
      width: 100%;
      padding: 0 32px;
      box-sizing: border-box;
    }

    /* ─── Header ─── */
    .chat-header {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid #e2e8f0;
      padding: 14px 0;
      z-index: 10;
    }
    .header-content {
      display: flex; justify-content: space-between; align-items: center;
    }
    .chat-title {
      font-weight: 700; font-size: 1.1em; color: #0f172a;
      display: flex; align-items: center; gap: 10px;
    }
    .ai-status {
      display: flex; align-items: center; gap: 6px;
      font-size: 0.82em; font-weight: 600;
      padding: 4px 12px; border-radius: 99px;
    }
    .ai-status.online { background: #f0fdf4; color: #16a34a; }
    .ai-status.offline { background: #fef2f2; color: #dc2626; }
    .status-dot { width: 7px; height: 7px; border-radius: 50%; }
    .online .status-dot { background: #16a34a; }
    .offline .status-dot { background: #dc2626; }

    /* ─── Scroll Area ─── */
    .chat-scroll-area {
      flex: 1;
      overflow-y: auto;
      padding: 24px 0;
      scroll-behavior: smooth;
    }
    .welcome-msg { text-align: center; padding: 60px 20px; color: #64748b; }
    .welcome-icon { margin-bottom: 16px; }
    .welcome-msg h3 { color: #0f172a; margin: 0 0 8px; font-size: 1.3em; }

    /* ─── Séparateur de date ─── */
    .date-separator {
      display: flex; justify-content: center;
      margin: 24px 0 16px;
    }
    .date-separator span {
      background: #e2e8f0; color: #475569;
      font-size: 0.75em; font-weight: 600;
      padding: 5px 14px; border-radius: 99px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }

    /* ─── Bulles de messages ─── */
    .msg-row { display: flex; margin-bottom: 6px; }
    .msg-row.user { justify-content: flex-end; }
    .msg-row.bot { justify-content: flex-start; }

    .msg-bubble {
      position: relative;
      max-width: 70%; /* Largeur max type WhatsApp */
      min-width: 80px; 
      padding: 8px 14px 22px 14px; 
      border-radius: 12px;
      line-height: 1.5;
      font-size: 0.95em;
      box-shadow: 0 1px 1px rgba(0,0,0,0.1);
    }
    .user-bubble {
      background: #d9fdd3; /* Vert WhatsApp clair */
      color: #111b21;
      border-bottom-right-radius: 0px;
    }
    .bot-bubble {
      background: #ffffff; 
      color: #111b21;
      border-bottom-left-radius: 0px;
    }
    .msg-content { white-space: pre-wrap; }

    /* L'heure incrustée */
    .msg-time {
      position: absolute;
      bottom: 4px; right: 8px;
      font-size: 0.7em; font-weight: 500;
    }
    .user-bubble .msg-time { color: #667781; }
    .bot-bubble .msg-time { color: #667781; }

    /* Badges IA */
    .source-badge {
      display: inline-flex; align-items: center; gap: 4px;
      margin-top: 8px; margin-bottom: 4px; padding: 5px 10px;
      background: #f0fdf4; color: #16a34a;
      border-radius: 8px; font-size: 0.8em; font-weight: 600;
      border: 1px solid #dcfce7;
    }
    .not-found-badge {
      margin-top: 8px; margin-bottom: 4px; padding: 6px 12px;
      background: #fff7ed; color: #d97706;
      border-radius: 8px; font-size: 0.82em; font-weight: 600;
      border: 1px solid #ffedd5;
    }

    /* Loader */
    .typing-bubble { padding: 14px 18px !important; min-width: auto; }
    .typing-indicator { display: flex; gap: 4px; align-items: center; }
    .typing-indicator span {
      width: 6px; height: 6px; border-radius: 50%;
      background: #94a3b8; animation: blink 1.4s infinite both;
    }
    .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes blink { 0%, 80%, 100% { opacity: 0.3; } 40% { opacity: 1; } }

    /* ─── Input Area ─── */
    .chat-input-area {
      background: #f0f2f5; /* Bandeau inférieur WhatsApp */
      padding: 8px 0 10px 0; /* Encore plus fin */
      z-index: 10;
    }
    .input-row { position: relative; display: flex; align-items: center; }
    .chat-input {
      flex: 1; border: none;
      border-radius: 8px; 
      padding: 10px 56px 10px 16px; /* Padding réduit pour une bande moins haute */
      font-size: 0.95em;
      outline: none; transition: all 0.2s;
      background: #ffffff;
      box-shadow: none;
    }
    .chat-input:disabled { background: #e2e8f0; cursor: not-allowed; }
    
    .send-btn {
      position: absolute; right: 8px;
      width: 40px; height: 40px; flex-shrink: 0;
      border: none; border-radius: 50%;
      background: transparent; color: #54656f; /* Gris WhatsApp */
      cursor: pointer; display: grid; place-items: center;
      transition: color 0.2s;
    }
    .send-btn:hover:not(:disabled) { color: #111b21; }
    .send-btn:disabled { color: #cbd5e1; cursor: not-allowed; }
    
    .offline-warning {
      background: #fff7ed; color: #d97706;
      padding: 8px 12px; border-radius: 8px; font-size: 0.85em; font-weight: 600;
      margin-bottom: 12px; text-align: center;
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
        // Le backend renvoie du plus récent au plus ancien (DESC). 
        // On inverse pour l'affichage continu de haut en bas.
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

        // Scroll tout en bas au chargement initial
        setTimeout(() => this.scrollToBottom(), 100);
      },
      error: () => {
        this.allMessages = [];
        this.loadingHistory = false;
      },
    });
  }

  private rebuildGroups(): void {
    const groupsMap = new Map<string, ChatMessage[]>();

    for (const msg of this.allMessages) {
      const d = new Date(msg.timestamp);
      d.setHours(0, 0, 0, 0); // On met à minuit pour grouper par jour
      const key = d.getTime().toString();

      if (!groupsMap.has(key)) {
        groupsMap.set(key, []);
      }
      groupsMap.get(key)!.push(msg);
    }

    // Trier les jours chronologiquement
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

    // Pour les autres jours : ex "Jeudi 12 Mai"
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  send(): void {
    const q = this.question?.trim();
    if (!q || this.loading) return;

    // Ajouter le message utilisateur localement
    const userMsg: ChatMessage = { role: 'user', content: q, timestamp: new Date() };
    this.allMessages.push(userMsg);
    this.rebuildGroups();

    this.question = '';
    this.loading = true;
    this.shouldScroll = true;

    // Appel API
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
