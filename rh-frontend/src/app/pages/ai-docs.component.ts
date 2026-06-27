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
    <section class="knowledge-shell">
      <header class="knowledge-header">
        <div>
          <h1>Référentiel documentaire RH intelligent</h1>
          <p>Centralisez les documents RH de référence utilisés par l'assistant RH.</p>
        </div>
      </header>

      <!-- Toast Notification -->
      <div class="toast-container" *ngIf="uploadSuccess || uploadError">
        <div class="toast" [class.toast-success]="uploadSuccess" [class.toast-error]="uploadError">
          <svg *ngIf="uploadSuccess" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <svg *ngIf="uploadError" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{{ uploadSuccess || uploadError }}</span>
        </div>
      </div>

      <main class="knowledge-content">
        <section class="upload-panel">
          <label class="dropzone" for="ai-doc-file">
            <span class="upload-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <path d="m17 8-5-5-5 5"></path>
                <path d="M12 3v12"></path>
              </svg>
            </span>
            <strong>{{ selectedFile ? selectedFile.name : 'Glissez votre PDF ou cliquez pour importer un document RH.' }}</strong>
            <span>Règlement intérieur, politique congés, procédure RH, guide collaborateur, charte télétravail...</span>
            <input id="ai-doc-file" type="file" (change)="onFileSelected($event)" accept=".pdf" />
          </label>

          <div class="upload-fields">
            <label>
              <span>Titre du document</span>
              <input type="text" [(ngModel)]="newTitle" placeholder="Ex. Politique de télétravail 2026" />
            </label>

            <button type="button" (click)="upload()" [disabled]="uploading || !newTitle || !selectedFile">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <path d="m17 8-5-5-5 5"></path>
                <path d="M12 3v12"></path>
              </svg>
              {{ uploading ? 'Import en cours...' : 'Importer le document' }}
            </button>
          </div>
        </section>

        <section class="docs-panel">
          <div class="docs-title">
            <div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path d="M2 4.5A2.5 2.5 0 0 1 4.5 2H12v20H4.5A2.5 2.5 0 0 1 2 19.5z"></path>
                <path d="M22 4.5A2.5 2.5 0 0 0 19.5 2H12v20h7.5a2.5 2.5 0 0 0 2.5-2.5z"></path>
              </svg>
              <h2>Documents de référence</h2>
              <span>{{ docs.length }}</span>
            </div>
          </div>

          <div class="empty-docs" *ngIf="docs.length === 0 && !loadError">
            Aucun document de référence pour le moment.
          </div>
          <p class="feedback error" *ngIf="loadError">{{ loadError }}</p>

          <div class="table-wrap" *ngIf="docs.length > 0">
            <table>
              <thead>
                <tr>
                  <th>Titre</th>
                  <th>Document</th>
                  <th>Ajouté le</th>
                  <th>Pages</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let d of docs">
                  <td data-label="Titre">{{ d.titre }}</td>
                  <td data-label="Document">
                    <a *ngIf="d.fichierUrl" [href]="fileUrl(d.fichierUrl)" target="_blank" rel="noopener" class="file-link">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <path d="M14 2v6h6"></path>
                      </svg>
                      {{ d.originalFileName }}
                    </a>
                  </td>
                  <td data-label="Ajouté le">{{ d.createdAt | date:'dd/MM/yyyy' }}</td>
                  <td data-label="Pages">{{ d.nbPages || '-' }}</td>
                  <td data-label="Statut">
                    <span class="status-badge" [class.available]="d.indexedInAI === true" [class.unavailable]="d.indexedInAI !== true">
                      <span></span>
                      {{ d.indexedInAI === true ? 'Disponible' : 'Indisponible' }}
                    </span>
                  </td>
                  <td data-label="Actions">
                    <div class="actions">
                      <button type="button" title="Réindexer" aria-label="Réindexer" (click)="reindex(d.id)" [disabled]="reindexing === d.id">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                          <path d="M21 12a9 9 0 0 0-15-6.7L3 8"></path>
                          <path d="M3 3v5h5"></path>
                          <path d="M3 12a9 9 0 0 0 15 6.7L21 16"></path>
                          <path d="M16 16h5v5"></path>
                        </svg>
                      </button>
                      <button type="button" title="Supprimer" aria-label="Supprimer" (click)="deleteDoc(d.id)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                          <path d="M3 6h18"></path>
                          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                          <path d="M10 11v6"></path>
                          <path d="M14 11v6"></path>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Custom Delete Modal -->
        <div class="docs-modal-backdrop" *ngIf="showDeleteModal">
          <section class="docs-modal docs-modal-sm">
            <h2>Suppression de document</h2>
            <p>Êtes-vous sûr de vouloir supprimer ce document du référentiel RH ?</p>
            <div class="docs-modal-actions">
              <button type="button" class="docs-cancel" (click)="cancelDelete()">Annuler</button>
              <button type="button" class="docs-danger" (click)="confirmDelete()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M3 6h18"></path>
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                  <path d="M10 11v6"></path>
                  <path d="M14 11v6"></path>
                </svg>
                Supprimer
              </button>
            </div>
          </section>
        </div>

      </main>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      min-height: 0;
    }

    .knowledge-shell {
      min-height: 100%;
      display: flex;
      flex-direction: column;
      background: #f4f7fb;
      color: #020617;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      overflow: hidden;
    }

    .knowledge-header {
      position: sticky;
      top: 0;
      z-index: 4;
      min-height: 78px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding: 18px 34px 15px;
      border-bottom: 1px solid #dfe6ef;
      background: #ffffff;
    }

    .knowledge-header h1 {
      margin: 0 0 5px;
      color: #020617;
      font-size: 22px;
      line-height: 1.2;
      font-weight: 500;
      letter-spacing: 0;
    }

    .knowledge-header p {
      margin: 0;
      color: #475569;
      font-size: 12px;
      line-height: 1.4;
      font-weight: 400;
    }

    .knowledge-content {
      padding: 24px 28px 28px;
      display: grid;
      gap: 18px;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      scrollbar-width: thin;
      scrollbar-color: #dbe3ef transparent;
    }

    .knowledge-content::-webkit-scrollbar {
      width: 4px;
    }

    .knowledge-content::-webkit-scrollbar-track {
      background: transparent;
    }

    .knowledge-content::-webkit-scrollbar-thumb {
      background: #dbe3ef;
      border-radius: 999px;
    }

    .upload-panel,
    .docs-panel {
      border: 1px solid #dfe6ef;
      border-radius: 7px;
      background: #ffffff;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
    }

    .upload-panel {
      padding: 18px;
    }

    .dropzone {
      min-height: 156px;
      border: 1px dashed #b9ccea;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 9px;
      color: #475569;
      background: #fbfdff;
      cursor: pointer;
      transition: border-color 0.18s ease, background 0.18s ease;
    }

    .dropzone:hover {
      border-color: #8fb0ea;
      background: #f8fbff;
    }

    .dropzone input {
      display: none;
    }

    .upload-icon {
      width: 48px;
      height: 48px;
      display: grid;
      place-items: center;
      border: 1px solid #d6e4fb;
      border-radius: 999px;
      color: #2563eb;
      background: #ffffff;
    }

    .upload-icon svg {
      width: 24px;
      height: 24px;
    }

    .dropzone strong {
      color: #020617;
      font-size: 14px;
      line-height: 1.25;
      font-weight: 500;
    }

    .dropzone span:last-child {
      max-width: 640px;
      color: #64748b;
      font-size: 12px;
      line-height: 1.4;
      font-weight: 400;
    }

    .upload-fields {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 180px;
      align-items: end;
      gap: 12px;
      margin-top: 16px;
    }

    .upload-fields label {
      display: grid;
      gap: 7px;
      min-width: 0;
    }

    .upload-fields label span {
      color: #475569;
      font-size: 12px;
      font-weight: 500;
      line-height: 1;
    }

    .upload-fields input {
      height: 39px;
      border: 1px solid #dbe3ef;
      border-radius: 6px;
      padding: 0 12px;
      outline: none;
      color: #0f172a;
      background: #ffffff;
      font-size: 12px;
      font-weight: 400;
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
    }

    .upload-fields input::placeholder {
      color: #8a9ab1;
    }

    .upload-fields input:focus {
      border-color: #93b4ee;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
    }

    .upload-fields button {
      height: 39px;
      border: none;
      border-radius: 7px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: #ffffff;
      background: #2563eb;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      line-height: 1;
      transition: background 0.18s ease, transform 0.18s ease;
    }

    .upload-fields button:hover:not(:disabled) {
      background: #1d4ed8;
      transform: translateY(-1px);
    }

    .upload-fields button:disabled {
      background: #9bb5e6;
      cursor: not-allowed;
      transform: none;
    }

    .upload-fields button svg {
      width: 14px;
      height: 14px;
    }

    /* Toast Notification */
    .toast-container {
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 9999;
      animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      border-radius: 10px;
      background: #fff;
      box-shadow: 0 10px 40px rgba(15, 23, 42, 0.12);
      border: 1px solid #e2e8f0;
      color: #0f172a;
      font-size: 13.5px;
      font-weight: 500;
    }

    .toast svg {
      width: 18px;
      height: 18px;
    }

    .toast-success svg {
      color: #10b981;
    }

    .toast-error svg {
      color: #ef4444;
    }

    @keyframes slideIn {
      from { transform: translateX(120%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    .docs-panel {
      padding: 18px;
      min-width: 0;
    }

    .docs-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 13px;
    }

    .docs-title > div {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .docs-title svg {
      width: 14px;
      height: 14px;
      color: #0f172a;
      flex: 0 0 auto;
    }

    .docs-title h2 {
      margin: 0;
      color: #020617;
      font-size: 14px;
      line-height: 1.25;
      font-weight: 500;
      letter-spacing: 0;
    }

    .docs-title span {
      min-width: 23px;
      height: 22px;
      padding: 0 7px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      border: 1px solid #dbe3ef;
      background: #f8fafc;
      color: #64748b;
      font-size: 11px;
      font-weight: 500;
    }

    .empty-docs {
      padding: 28px 12px;
      color: #64748b;
      text-align: center;
      font-size: 13px;
      border: 1px solid #eef2f7;
      border-radius: 7px;
      background: #fbfdff;
    }

    .table-wrap {
      width: 100%;
      overflow-x: hidden;
      border: 1px solid #dfe6ef;
      border-radius: 7px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      background: #ffffff;
    }

    th,
    td {
      height: 50px;
      padding: 0 14px;
      border-bottom: 1px solid #e5ecf5;
      text-align: left;
      vertical-align: middle;
      font-size: 12px;
      line-height: 1.35;
      font-weight: 400;
      color: #020617;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    th {
      height: 39px;
      color: #475569;
      background: #f8fafc;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.35px;
      text-transform: uppercase;
    }

    tr:last-child td {
      border-bottom: none;
    }

    th:nth-child(1), td:nth-child(1) { width: 32%; }
    th:nth-child(2), td:nth-child(2) { width: 25%; }
    th:nth-child(3), td:nth-child(3) { width: 12%; }
    th:nth-child(4), td:nth-child(4) { width: 8%; text-align: center; }
    th:nth-child(5), td:nth-child(5) { width: 13%; }
    th:nth-child(6), td:nth-child(6) { width: 10%; text-align: right; }

    .file-link {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      max-width: 100%;
      color: #2563eb;
      text-decoration: none;
      font-weight: 400;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .file-link:hover {
      text-decoration: underline;
    }

    .file-link svg {
      width: 14px;
      height: 14px;
      flex: 0 0 auto;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 26px;
      padding: 0 11px;
      border-radius: 999px;
      font-size: 12px;
      line-height: 1;
      font-weight: 600;
    }

    .status-badge span {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      display: block;
    }

    .status-badge.available {
      color: #047857;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
    }

    .status-badge.available span {
      background: #059669;
    }

    .status-badge.unavailable {
      color: #dc2626;
      background: #fef2f2;
      border: 1px solid #fecaca;
    }

    .status-badge.unavailable span {
      background: #dc2626;
    }

    .actions {
      display: inline-flex;
      justify-content: flex-end;
      align-items: center;
      gap: 7px;
    }

    .actions button {
      width: 28px;
      height: 28px;
      border: 1px solid #dbe3ef;
      border-radius: 7px;
      display: inline-grid;
      place-items: center;
      color: #64748b;
      background: #ffffff;
      cursor: pointer;
      transition: color 0.18s ease, border-color 0.18s ease, background 0.18s ease;
    }

    .actions button:hover:not(:disabled) {
      color: #1d4ed8;
      border-color: #bfcef3;
      background: #f8fbff;
    }

    .actions button:disabled {
      opacity: 0.55;
      cursor: wait;
    }

    .actions svg {
      width: 15px;
      height: 15px;
    }

    @media (max-width: 980px) {
      .knowledge-header,
      .knowledge-content {
        padding-left: 18px;
        padding-right: 18px;
      }

      .upload-fields {
        grid-template-columns: 1fr;
      }

      .upload-fields button {
        width: 100%;
      }

      .table-wrap {
        border: none;
        overflow: visible;
      }

      table,
      thead,
      tbody,
      tr,
      th,
      td {
        display: block;
      }

      thead {
        display: none;
      }

      tr {
        border: 1px solid #dfe6ef;
        border-radius: 8px;
        margin-bottom: 10px;
        overflow: hidden;
      }

      td {
        width: 100% !important;
        height: auto;
        min-height: 42px;
        display: flex;
        justify-content: space-between;
        gap: 16px;
        text-align: right !important;
        white-space: normal;
      }

      td::before {
        content: attr(data-label);
        color: #64748b;
        font-weight: 600;
        text-align: left;
      }
    }

    /* Modal Styles */
    .docs-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 80;
      align-items: center;
      background: rgba(15, 23, 42, .42);
      display: flex;
      justify-content: center;
      padding: 18px;
    }

    .docs-modal {
      background: #fff;
      border-radius: 10px;
      box-shadow: 0 24px 70px rgba(15, 23, 42, .22);
      max-width: 520px;
      padding: 22px 20px 20px;
      width: 100%;
    }

    .docs-modal.docs-modal-sm {
      box-shadow: 0 10px 40px rgba(15, 23, 42, .12);
      border: 1px solid #dfe6ef;
    }

    .docs-modal h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 500;
    }

    .docs-modal p {
      color: #64748b;
      font-size: 13px;
      margin: 10px 0 17px;
    }

    .docs-modal-actions {
      align-items: center;
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 14px;
    }

    .docs-cancel {
      background: transparent;
      border: 0;
      color: #64748b;
      min-height: 36px;
      padding: 0 10px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 400;
    }

    .docs-danger {
      background: #dc2626;
      border: 0;
      color: #fff;
      min-height: 38px;
      padding: 0 16px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      border-radius: 7px;
    }

    .docs-danger svg {
      width: 15px;
      height: 15px;
    }
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
  showDeleteModal = false;
  docToDelete: number | null = null;
  private toastTimeout: any;

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

  showToast(msg: string, isError = false): void {
    if (isError) {
      this.uploadError = msg;
      this.uploadSuccess = null;
    } else {
      this.uploadSuccess = msg;
      this.uploadError = null;
    }
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.uploadSuccess = null;
      this.uploadError = null;
    }, 5000);
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
        this.showToast('Document importé avec succès.');
        this.newTitle = '';
        this.selectedFile = null;
        this.uploading = false;
        this.loadDocs();
        this.loadStatus();
      },
      error: e => {
        this.showToast(e?.error?.error ?? "Erreur lors de l'import.", true);
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
    this.docToDelete = id;
    this.showDeleteModal = true;
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.docToDelete = null;
  }

  confirmDelete(): void {
    if (this.docToDelete === null) return;
    const id = this.docToDelete;
    this.http.delete(`${this.API}/${id}`).subscribe({
      next: () => { 
        this.loadDocs(); 
        this.loadStatus(); 
        this.showDeleteModal = false;
        this.docToDelete = null;
      },
      error: e => {
        alert(e?.error?.error ?? 'Erreur lors de la suppression.');
        this.showDeleteModal = false;
        this.docToDelete = null;
      }
    });
  }

  fileUrl(path: string): string {
    return path.startsWith('http') ? path : `${environment.apiUrl}${path}`;
  }
}
