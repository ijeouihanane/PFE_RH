import { Component, OnInit } from '@angular/core';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
import { AiDocItem, AiStatus } from '../core/chat.model';

@Component({
  standalone: true,
  selector: 'app-ai-docs',
  imports: [NgIf, NgFor, FormsModule, DatePipe],
  template: `
    <div class="ai-docs-page">
      <!-- En-tête -->
      <div class="page-header card">
        <div class="header-left">
          <h2>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 8px;">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            Base documentaire IA
          </h2>
          <p class="subtitle">Uploadez des documents PDF pour alimenter le chatbot IA.</p>
        </div>
        <div class="header-right">
          <div class="status-chip" [class.online]="aiStatus?.available" [class.offline]="!aiStatus?.available">
            <span class="dot"></span>
            {{ aiStatus?.available ? 'IA disponible' : 'IA indisponible' }}
          </div>
          <div class="counter" *ngIf="aiStatus">{{ aiStatus.documentsIndexed }} document(s) indexé(s)</div>
        </div>
      </div>

      <!-- Formulaire Upload -->
      <div class="card upload-card">
        <h3>Ajouter un document PDF</h3>
        <div class="upload-form">
          <div class="field">
            <label>Titre du document</label>
            <input type="text" [(ngModel)]="newTitle" placeholder="Ex: Règlement intérieur 2025" />
          </div>
          <div class="field">
            <label>Fichier PDF</label>
            <div class="file-input-wrapper">
              <input type="file" (change)="onFileSelected($event)" accept=".pdf" #fileInput />
              <span class="file-name" *ngIf="selectedFile">{{ selectedFile.name }}</span>
            </div>
          </div>
          <div class="upload-actions">
            <button class="btn btn-primary" (click)="upload()" [disabled]="uploading || !newTitle || !selectedFile">
              <span *ngIf="!uploading">Uploader & Indexer</span>
              <span *ngIf="uploading">Indexation en cours...</span>
            </button>
          </div>
          <div class="msg error" *ngIf="uploadError">{{ uploadError }}</div>
          <div class="msg success" *ngIf="uploadSuccess">{{ uploadSuccess }}</div>
        </div>
      </div>

      <!-- Tableau des documents -->
      <div class="card">
        <h3>Documents indexés</h3>
        <div class="muted" *ngIf="docs.length === 0 && !loadError">Aucun document pour le moment.</div>
        <div class="msg error" *ngIf="loadError">{{ loadError }}</div>

        <table *ngIf="docs.length > 0">
          <thead>
            <tr>
              <th>Titre</th>
              <th>Fichier</th>
              <th>Statut IA</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let d of docs">
              <td><b>{{ d.titre }}</b></td>
              <td>
                <a *ngIf="d.fichierUrl" [href]="fileUrl(d.fichierUrl)" target="_blank" class="file-link">
                  {{ d.originalFileName }}
                </a>
              </td>
              <td>
                <span class="ai-badge indexed" *ngIf="d.indexedInAI === true">✅ Indexé</span>
                <span class="ai-badge error" *ngIf="d.indexedInAI === false">❌ Erreur</span>
                <span class="ai-badge pending" *ngIf="d.indexedInAI == null">⏳ En attente</span>
              </td>
              <td>{{ d.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
              <td class="actions-cell">
                <button class="btn btn-ghost btn-sm" *ngIf="d.indexedInAI !== true"
                        (click)="reindex(d.id)" [disabled]="reindexing === d.id">
                  {{ reindexing === d.id ? '...' : 'Ré-indexer' }}
                </button>
                <button class="btn btn-danger btn-sm" (click)="deleteDoc(d.id)">Supprimer</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .ai-docs-page { display: flex; flex-direction: column; gap: 16px; }

    .page-header {
      display: flex; justify-content: space-between; align-items: flex-start;
    }
    .page-header h2 {
      margin: 0 0 4px; font-size: 1.3em; color: #0f172a;
      display: flex; align-items: center;
    }
    .subtitle { color: #64748b; font-size: 0.9em; margin: 0; }

    .header-right { text-align: right; }

    .status-chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 5px 12px; border-radius: 99px; font-size: 0.82em; font-weight: 600;
    }
    .status-chip.online { background: #f0fdf4; color: #16a34a; }
    .status-chip.offline { background: #fef2f2; color: #dc2626; }
    .dot {
      width: 8px; height: 8px; border-radius: 50%;
    }
    .online .dot { background: #16a34a; }
    .offline .dot { background: #dc2626; }
    .counter { font-size: 0.85em; color: #64748b; margin-top: 6px; }

    .upload-card h3 { margin-top: 0; }
    .upload-form { display: flex; flex-direction: column; gap: 12px; }
    .upload-actions { display: flex; gap: 8px; }

    .file-input-wrapper { display: flex; align-items: center; gap: 8px; }
    .file-name { font-size: 0.85em; color: #64748b; }

    .msg { font-size: 0.9em; padding: 8px 12px; border-radius: 8px; }
    .msg.error { background: #fef2f2; color: #dc2626; }
    .msg.success { background: #f0fdf4; color: #16a34a; }
    .muted { color: #64748b; font-size: 0.9em; }

    table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
    th {
      text-align: left; padding: 10px; border-bottom: 2px solid #e2e8f0;
      color: #64748b; font-weight: 600;
    }
    td { padding: 10px; border-bottom: 1px solid #f1f5f9; }

    .file-link { color: #2563eb; text-decoration: underline; font-size: 0.88em; }

    .ai-badge {
      display: inline-block; padding: 3px 10px; border-radius: 99px;
      font-size: 0.8em; font-weight: 600;
    }
    .ai-badge.indexed { background: #f0fdf4; color: #16a34a; }
    .ai-badge.error   { background: #fef2f2; color: #dc2626; }
    .ai-badge.pending  { background: #fffbeb; color: #d97706; }

    .actions-cell { display: flex; gap: 6px; }
    .btn-sm { font-size: 0.8em; padding: 4px 10px; }
    .btn-danger {
      background: #fef2f2; color: #dc2626; border: none;
      border-radius: 8px; cursor: pointer; font-weight: 600;
    }
    .btn-danger:hover { background: #fee2e2; }

    .summaries { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
    .summary-card { padding: 14px; }
    .summary-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .keywords { font-size: 0.78em; color: #64748b; font-style: italic; }
    .summary-text { font-size: 0.88em; color: #475569; margin: 0; line-height: 1.5; }
  `],
})
export class AiDocsComponent implements OnInit {
  docs: AiDocItem[] = [];
  aiStatus: AiStatus | null = null;
  newTitle = '';
  selectedFile: File | null = null;
  uploading = false;
  uploadError: string | null = null;
  uploadSuccess: string | null = null;
  loadError: string | null = null;
  reindexing: number | null = null;

  private readonly API = `${environment.apiUrl}/api/documents/ai`;

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.loadStatus();
    this.loadDocs();
  }

  loadStatus(): void {
    this.http.get<AiStatus>(`${this.API}/status`).subscribe({
      next: s => this.aiStatus = s,
      error: () => this.aiStatus = { available: false, documentsIndexed: 0, documentsInDb: 0 },
    });
  }

  loadDocs(): void {
    this.loadError = null;
    this.http.get<AiDocItem[]>(`${this.API}/list`).subscribe({
      next: d => this.docs = d,
      error: e => this.loadError = e?.error?.error ?? 'Impossible de charger les documents.',
    });
  }

  onFileSelected(event: any): void {
    this.selectedFile = event.target.files[0] ?? null;
  }

  upload(): void {
    if (!this.newTitle || !this.selectedFile) return;
    this.uploading = true;
    this.uploadError = null;
    this.uploadSuccess = null;

    const fd = new FormData();
    fd.append('titre', this.newTitle);
    fd.append('file', this.selectedFile);

    this.http.post<AiDocItem>(`${this.API}/upload`, fd).subscribe({
      next: () => {
        this.uploadSuccess = 'Document uploadé et indexé avec succès !';
        this.newTitle = '';
        this.selectedFile = null;
        this.uploading = false;
        this.loadDocs();
        this.loadStatus();
      },
      error: e => {
        this.uploadError = e?.error?.error ?? "Erreur lors de l'upload.";
        this.uploading = false;
      },
    });
  }

  reindex(id: number): void {
    this.reindexing = id;
    this.http.post<AiDocItem>(`${this.API}/reindex/${id}`, {}).subscribe({
      next: () => { this.reindexing = null; this.loadDocs(); this.loadStatus(); },
      error: () => { this.reindexing = null; },
    });
  }

  deleteDoc(id: number): void {
    if (!confirm('Supprimer ce document et ses vecteurs IA ?')) return;
    this.http.delete(`${this.API}/${id}`).subscribe({
      next: () => { this.loadDocs(); this.loadStatus(); },
      error: e => alert(e?.error?.error ?? 'Erreur lors de la suppression.'),
    });
  }

  fileUrl(path: string): string {
    return path.startsWith('http') ? path : `${environment.apiUrl}${path}`;
  }
}
