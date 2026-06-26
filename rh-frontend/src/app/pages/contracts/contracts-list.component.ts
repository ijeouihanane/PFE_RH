import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ContractService } from './contract.service';
import { ContractResponse, ContractType, ContractStatus } from './contract.model';

@Component({
  standalone: true,
  selector: 'app-contracts-list',
  imports: [CommonModule, FormsModule, RouterLink],
  styles: [`
    :host { display: block; background: #f8fafc; min-height: 100%; box-sizing: border-box; }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 18px;
    }
    .page-header-left h1 {
      font-size: 22px;
      font-weight: 700;
      color: #111827;
      margin: 0 0 4px 0;
    }
    .page-header-left p {
      font-size: 13px;
      color: #6b7280;
      margin: 0;
    }
    .btn-new {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 10px 18px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      white-space: nowrap;
    }
    .btn-new:hover { background: #1d4ed8; }

    /* Unified card: filters + table */
    .main-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      overflow: hidden;
    }

    /* Filters inside the card */
    .filters-bar {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      padding: 16px 20px;
      border-bottom: 1px solid #e5e7eb;
      flex-wrap: wrap;
    }
    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .filter-group label {
      font-size: 11px;
      color: #6b7280;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .filter-input {
      border: 1px solid #e5e7eb;
      border-radius: 7px;
      padding: 7px 11px;
      font-size: 13px;
      color: #111827;
      background: white;
      outline: none;
      height: 36px;
      min-width: 160px;
    }
    .filter-input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.08); }
    .filter-select { min-width: 110px; }
    .btn-reset {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 7px;
      padding: 0 14px;
      height: 36px;
      font-size: 13px;
      color: #374151;
      cursor: pointer;
      font-weight: 500;
      margin-left: auto;
      white-space: nowrap;
    }
    .btn-reset:hover { background: #f9fafb; border-color: #d1d5db; }

    /* Table */
    table { width: 100%; border-collapse: collapse; }
    thead { background: #f9fafb; }
    th {
      padding: 11px 16px;
      text-align: left;
      font-size: 11px;
      font-weight: 650;
      color: #2563eb;
      text-transform: uppercase;
      letter-spacing: .04em;
      border-bottom: 1px solid #e5e7eb;
      white-space: nowrap;
    }
    td {
      padding: 14px 16px;
      font-size: 14px;
      color: #374151;
      border-bottom: 1px solid #f3f4f6;
      vertical-align: middle;
    }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover { background: #fafbff; }

    .emp-name { font-weight: 600; color: #111827; }
    .matricule { font-size: 13px; color: #6b7280; }

    /* Type badge */
    .badge-type {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      background: #eff6ff;
      color: #2563eb;
      border: 1px solid #bfdbfe;
    }

    /* Status badges */
    .badge-status {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge-brouillon { background: #fef3c7; color: #92400e; }
    .badge-genere    { background: #d1fae5; color: #065f46; }

    .period { font-size: 13px; white-space: nowrap; }

    /* Action icon buttons */
    .actions { display: flex; gap: 6px; align-items: center; justify-content: center; }
    .act-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 7px;
      cursor: pointer;
      border: 1px solid;
      text-decoration: none;
      transition: background .15s, color .15s;
    }
    .act-btn svg { flex-shrink: 0; }
    .act-btn-edit {
      background: #eff6ff;
      border-color: #bfdbfe;
      color: #1d4ed8;
    }
    .act-btn-edit:hover { background: #dbeafe; }
    .act-btn-dl {
      background: #f0fdf4;
      border-color: #bbf7d0;
      color: #059669;
    }
    .act-btn-dl:hover { background: #dcfce7; }
    .act-btn-del {
      background: #fff1f2;
      border-color: #fecdd3;
      color: #dc2626;
    }
    .act-btn-del:hover { background: #ffe4e6; }

    /* Empty */
    .empty-row td { text-align: center; padding: 48px; color: #6b7280; font-size: 14px; font-style: italic; }

    /* Toast */
    .toast {
      position: fixed; top: 16px; right: 20px; z-index: 2000;
      padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500;
      box-shadow: 0 4px 14px rgba(0,0,0,0.15);
      animation: slideIn .2s ease;
    }
    .toast-ok { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
    @keyframes slideIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }

    /* Modal */
    .modal-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(17, 24, 39, 0.4);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999;
    }
    .modal-content {
      background: white; border-radius: 12px;
      width: 420px; max-width: 90%;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      overflow: hidden;
    }
    .modal-header {
      display: flex; align-items: center; gap: 12px;
      padding: 20px 24px; border-bottom: 1px solid #f3f4f6;
    }
    .modal-header h3 { margin: 0; font-size: 16px; font-weight: 600; color: #111827; }
    .modal-body { padding: 24px; font-size: 14px; color: #4b5563; line-height: 1.5; }
    .modal-actions {
      padding: 16px 24px; background: #f9fafb;
      display: flex; justify-content: flex-end; gap: 12px;
    }
    .btn-cancel {
      padding: 8px 16px; border-radius: 6px; border: 1px solid #d1d5db;
      background: white; color: #374151; font-weight: 500; cursor: pointer;
    }
    .btn-cancel:hover { background: #f3f4f6; }
    .btn-confirm {
      padding: 8px 16px; border-radius: 6px; border: none;
      background: #dc2626; color: white; font-weight: 500; cursor: pointer;
    }
    .btn-confirm:hover { background: #b91c1c; }
  `],
  template: `
    <!-- Toast succès après génération -->
    <div class="toast toast-ok" *ngIf="toastMsg">{{ toastMsg }}</div>

    <div class="page-header">
      <div class="page-header-left">
        <h1>Contrats RH</h1>
        <p>Création, suivi et génération des contrats de travail.</p>
      </div>
      <a routerLink="/contracts/new" class="btn-new">+ Nouveau contrat</a>
    </div>

    <!-- Unified card: filters + table -->
    <div class="main-card">

      <!-- Filters bar inside the card -->
      <div class="filters-bar">
        <div class="filter-group">
          <label>Employé</label>
          <input class="filter-input" type="text" placeholder="Rechercher…" [(ngModel)]="filterName" (ngModelChange)="applyFilters()" />
        </div>
        <div class="filter-group">
          <label>Type</label>
          <select class="filter-input filter-select" [(ngModel)]="filterType" (ngModelChange)="applyFilters()">
            <option value="">Tous</option>
            <option value="CDI">CDI</option>
            <option value="CDD">CDD</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Statut</label>
          <select class="filter-input filter-select" [(ngModel)]="filterStatus" (ngModelChange)="applyFilters()">
            <option value="">Tous</option>
            <option value="BROUILLON">Brouillon</option>
            <option value="GENERE">Généré</option>
          </select>
        </div>
        <button class="btn-reset" (click)="resetFilters()">Réinitialiser</button>
      </div>

      <!-- Table -->
      <table>
        <thead>
          <tr>
            <th>Employé</th>
            <th>Matricule</th>
            <th>Type</th>
            <th>Période</th>
            <th>Statut</th>
            <th>Créé le</th>
            <th>Dernière modif.</th>
            <th style="text-align:center">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngIf="filtered.length === 0" class="empty-row">
            <td colspan="8">Aucun contrat trouvé.</td>
          </tr>
          <tr *ngFor="let c of filtered">
            <td><span class="emp-name">{{ c.employeeFullName || '—' }}</span></td>
            <td><span class="matricule">{{ c.employeeMatricule || '—' }}</span></td>
            <td><span class="badge-type">{{ c.type }}</span></td>
            <td class="period">
              <span *ngIf="c.type === 'CDI'">à partir du {{ c.startDate | date:'dd/MM/yyyy' }}</span>
              <span *ngIf="c.type === 'CDD'">{{ c.startDate | date:'dd/MM/yyyy' }} → {{ c.endDate ? (c.endDate | date:'dd/MM/yyyy') : '—' }}</span>
            </td>
            <td>
              <span class="badge-status"
                [class.badge-brouillon]="c.status === 'BROUILLON'"
                [class.badge-genere]="c.status === 'GENERE'">
                {{ c.status === 'BROUILLON' ? 'Brouillon' : 'Généré' }}
              </span>
            </td>
            <td>{{ c.createdAt | date:'dd/MM/yyyy' }}</td>
            <td>{{ c.updatedAt | date:'dd/MM/yyyy' }}</td>
            <td>
              <div class="actions">
                <!-- BROUILLON : Modifier + Supprimer -->
                <ng-container *ngIf="c.status === 'BROUILLON'">
                  <a [routerLink]="['/contracts', c.id]" class="act-btn act-btn-edit" title="Modifier">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </a>
                  <button class="act-btn act-btn-del" (click)="confirmDelete(c)" title="Supprimer">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                </ng-container>
                <!-- GENERE : Télécharger + Supprimer -->
                <ng-container *ngIf="c.status === 'GENERE'">
                  <button class="act-btn act-btn-dl" (click)="openPdf(c)" title="Télécharger">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </button>
                  <button class="act-btn act-btn-del" (click)="confirmDeleteGenerated(c)" title="Supprimer">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                </ng-container>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal Confirmation de suppression -->
    <div class="modal-overlay" *ngIf="showModal">
      <div class="modal-content">
        <div class="modal-header">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <h3>Confirmation de suppression</h3>
        </div>
        <div class="modal-body">
          <p [innerHTML]="modalMessage"></p>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" (click)="closeModal()">Annuler</button>
          <button class="btn-confirm" (click)="confirmDeleteAction()">Supprimer</button>
        </div>
      </div>
    </div>
  `
})


export class ContractsListComponent implements OnInit {
  all: ContractResponse[] = [];
  filtered: ContractResponse[] = [];

  filterName   = '';
  filterType   = '';
  filterStatus = '';

  toastMsg = '';
  private toastTimer?: ReturnType<typeof setTimeout>;

  // Modal State
  showModal = false;
  modalMessage = '';
  contractToDelete: ContractResponse | null = null;

  constructor(private svc: ContractService, private router: Router) {}

  ngOnInit() {
    // Lire le toast passé via navigation state (après génération)
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state as any;
    if (state?.toast) {
      this.showToast(state.toast);
    } else {
      // Fallback : lire depuis history.state (après redirection complète)
      const hist = (window.history.state as any);
      if (hist?.toast) {
        this.showToast(hist.toast);
      }
    }
    this.load();
  }

  private showToast(msg: string) {
    this.toastMsg = msg;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toastMsg = ''; }, 4000);
  }

  load() {
    this.svc.list().subscribe(data => {
      this.all = data;
      this.applyFilters();
    });
  }

  applyFilters() {
    this.filtered = this.all.filter(c => {
      const nameOk   = !this.filterName   || (c.employeeFullName || '').toLowerCase().includes(this.filterName.toLowerCase());
      const typeOk   = !this.filterType   || c.type === this.filterType;
      const statusOk = !this.filterStatus || c.status === this.filterStatus;
      return nameOk && typeOk && statusOk;
    });
  }

  resetFilters() {
    this.filterName = ''; this.filterType = ''; this.filterStatus = '';
    this.applyFilters();
  }

  confirmDelete(c: ContractResponse) {
    this.contractToDelete = c;
    this.modalMessage = `Voulez-vous vraiment supprimer le brouillon de <b>${c.employeeFullName}</b> ?`;
    this.showModal = true;
  }

  confirmDeleteGenerated(c: ContractResponse) {
    this.contractToDelete = c;
    this.modalMessage = `Voulez-vous vraiment supprimer le contrat généré de <b>${c.employeeFullName}</b> ?<br><br><span style="color:#dc2626">Cette action supprimera définitivement l'enregistrement et le fichier PDF généré.</span>`;
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.contractToDelete = null;
  }

  confirmDeleteAction() {
    if (this.contractToDelete) {
      this.svc.delete(this.contractToDelete.id).subscribe(() => {
        this.load();
        this.closeModal();
      });
    }
  }

  /**
   * Ouvre le PDF généré dans un nouvel onglet via la gateway.
   * Si pdfUrl est disponible, ouvre le fichier stocké directement.
   * Fallback sur l'API /pdf si pdfUrl absent.
   */
  openPdf(c: ContractResponse): void {
    if (c.pdfUrl) {
      this.svc.openPdf(c.pdfUrl);
    } else {
      this.svc.downloadPdfById(c.id);
    }
  }
}
