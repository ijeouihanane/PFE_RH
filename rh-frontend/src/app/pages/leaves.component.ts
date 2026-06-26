import { CommonModule, DatePipe, NgClass } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { environment } from '../../environments/environment';
import { LeaveIconComponent } from './leave-icon.component';

type Role = 'EMPLOYEE' | 'MANAGER' | 'RH' | 'ADMIN';
type ViewMode = 'MAIN' | 'CREATE' | 'DETAIL' | 'BALANCES' | 'HOLIDAYS';
type ConfirmAction = 'EMP_CANCEL' | 'MGR_APPROVE' | 'MGR_REJECT' | 'RH_APPROVE' | 'RH_REJECT' | 'RH_CANCEL';

interface LeaveRequest {
  id: number;
  employeeId: number;
  typeConge: string;
  dateDebut: string;
  dateFin: string;
  nbJours: number;
  joursCalendaires?: number;
  weekendsExclus?: number;
  joursFeriesExclus?: number;
  statut: string;
  motif?: string | null;
  commentaireManager?: string | null;
  commentaireRh?: string | null;
  managerId?: number | null;
  rhId?: number | null;
  justificatifUrl?: string | null;
  justificatifName?: string | null;
  cancelReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface LeaveHistory {
  id: number;
  actorId?: number;
  actorRole?: string;
  action: string;
  oldStatus?: string;
  newStatus?: string;
  commentaire?: string | null;
  createdAt: string;
}

interface UserRow {
  id: number;
  nom: string;
  prenom: string;
  matricule?: string;
  role: Role;
  poste?: string;
  departement?: string;
  managerId?: number | null;
  actif?: boolean;
}

interface BalanceRow {
  employeeId: number;
  employee?: UserRow;
  soldeAnnuel: number;
  joursUtilises: number;
  joursRestants: number;
  annee: number;
}

interface PublicHoliday {
  id: number;
  date: string;
  year: number;
  name: string;
  kind: 'NATIONAL' | 'RELIGIOUS' | 'COMPANY';
  source: 'CALENDARIFIC' | 'FALLBACK' | 'MANUAL';
  locked: boolean;
  active: boolean;
}

@Component({
  standalone: true,
  selector: 'app-leaves',
  imports: [
    CommonModule,
    FormsModule,
    DatePipe,
    NgClass,
    LeaveIconComponent,
  ],
  template: `
    <section class="leave-page">
      <ng-container [ngSwitch]="viewMode">
        <ng-container *ngSwitchCase="'CREATE'">
          <div class="surface detail-surface">
            <header class="surface-head">
              <h2>{{ role === 'MANAGER' ? 'Nouvelle demande personnelle' : 'Nouvelle demande de congé' }}</h2>
              <button class="icon-btn ghost" type="button" (click)="closeView()" aria-label="Fermer"><app-icon name="x"></app-icon></button>
            </header>
            <div class="notice" *ngIf="role === 'MANAGER'">
              Votre demande sera transmise a {{ managerLabel(auth.user?.id || 0) || 'la RH' }}.
            </div>
            <form class="leave-form" (ngSubmit)="submitCreate()">
              <div class="form-grid">
                <label>
                  <span>Type de congé</span>
                  <select name="typeConge" [(ngModel)]="draft.typeConge" (ngModelChange)="recalculateDraft()">
                    <option *ngFor="let t of leaveTypes" [value]="t.value">{{ t.label }}</option>
                  </select>
                </label>
                <div class="file-field">
                  <span>Justificatif {{ attachmentRequired(draft.typeConge) ? '(obligatoire)' : '(optionnel)' }}</span>
                  <div class="file-input-row">
                    <label class="file-picker">
                      Choisir un fichier
                      <input type="file" (change)="onFilePicked($event)" />
                    </label>
                    <em>{{ selectedFile?.name || 'Aucun fichier choisi' }}</em>
                  </div>
                </div>
                <label>
                  <span>Date debut</span>
                  <input type="date" name="dateDebut" [(ngModel)]="draft.dateDebut" (ngModelChange)="recalculateDraft()" required />
                </label>
                <label>
                  <span>Date fin</span>
                  <input type="date" name="dateFin" [(ngModel)]="draft.dateFin" (ngModelChange)="recalculateDraft()" required />
                </label>
              </div>
              <label>
                <span>Motif</span>
                <textarea name="motif" [(ngModel)]="draft.motif" rows="4" placeholder="Decrivez le motif de votre demande..."></textarea>
              </label>
              <div class="calc-box">
                <h3>Résumé du calcul</h3>
                <div class="calc-grid">
                  <div><span>Jours calendaires</span><b>{{ draftCalc.joursCalendaires }}</b></div>
                  <div><span>Week-ends exclus</span><b>{{ draftCalc.weekendsExclus }}</b></div>
                  <div><span>Jours fériés exclus</span><b>{{ draftCalc.joursFeriesExclus }}</b></div>
                  <div class="accent"><span>Jours ouvrés déduits</span><b>{{ draftCalc.joursOuvres }}</b></div>
                  <div><span>Solde apres</span><b>{{ projectedBalanceAfter() }} j</b></div>
                </div>
              </div>
              <p class="error-msg" *ngIf="formError">{{ formError }}</p>
              <footer class="form-actions">
                <button class="btn light" type="button" (click)="closeView()">Annuler</button>
                <button class="btn primary" type="submit">Soumettre</button>
              </footer>
            </form>
          </div>
        </ng-container>

        <ng-container *ngSwitchCase="'DETAIL'">
          <div class="surface detail-surface" *ngIf="selected">
            <header class="surface-head">
              <h2>{{ detailTitle(selected) }}</h2>
              <button class="icon-btn ghost" type="button" (click)="closeView()" aria-label="Fermer"><app-icon name="x"></app-icon></button>
            </header>
            <div class="detail-meta">
              <div><span>Référence</span><b>{{ ref(selected) }}</b></div>
              <div><span>Type</span><b>{{ typeLabel(selected.typeConge) }}</b></div>
              <div><span>Statut</span><span class="badge" [ngClass]="statusClass(selected.statut)">{{ statusLabel(selected.statut) }}</span></div>
              <div *ngIf="showPeopleMeta(selected)"><span>Employé</span><b>{{ userName(selected.employeeId) }}</b></div>
              <div *ngIf="showPeopleMeta(selected)"><span>Matricule</span><b>{{ userMatricule(selected.employeeId) || '-' }}</b></div>
              <div *ngIf="showPeopleMeta(selected)"><span>Département</span><b>{{ userDept(selected.employeeId) }}</b></div>
              <div *ngIf="showPeopleMeta(selected)"><span>Manager</span><b>{{ selected.managerId ? userName(selected.managerId) : 'RH direct' }}</b></div>
              <div><span>Période</span><b>{{ formatPeriod(selected) }}</b></div>
              <div><span>Motif</span><b>{{ selected.motif || '-' }}</b></div>
              <div *ngIf="selected.justificatifUrl || showPeopleMeta(selected)"><span>Justificatif</span>
                <a *ngIf="selected.justificatifUrl" [href]="fileUrl(selected.justificatifUrl)" target="_blank">{{ selected.justificatifName || 'Télécharger' }}</a>
                <b *ngIf="!selected.justificatifUrl">Non requis / absent</b>
              </div>
            </div>
            <div class="calc-box">
              <h3>Calcul des jours</h3>
              <div class="calc-grid">
                <div><span>Jours calendaires</span><b>{{ selected.joursCalendaires || selected.nbJours }}</b></div>
                <div><span>Week-ends exclus</span><b>{{ selected.weekendsExclus || 0 }}</b></div>
                <div><span>Jours fériés exclus</span><b>{{ selected.joursFeriesExclus || 0 }}</b></div>
                <div class="accent"><span>Jours ouvrés déduits</span><b>{{ selected.nbJours }}</b></div>
                <div><span>Solde apres</span><b>{{ balanceAfter(selected) }} j</b></div>
              </div>
            </div>
            <section class="timeline">
              <h3>Timeline</h3>
              <div class="tl-row" *ngFor="let h of historyRows">
                <span class="tl-dot"></span>
                <div>
                  <b>{{ historyLabel(h.action) }}</b>
                  <p>{{ actorName(h.actorId) }} - {{ h.createdAt | date:'yyyy-MM-dd HH:mm' }}</p>
                  <em *ngIf="h.commentaire">"{{ h.commentaire }}"</em>
                </div>
              </div>
            </section>
            <footer class="form-actions detail-actions">
              <button class="btn danger-light" *ngIf="canEmployeeCancel(selected)" (click)="openConfirm('EMP_CANCEL', selected)">Annuler la demande</button>
              <button class="btn light" *ngIf="canManagerAct(selected)" (click)="openConfirm('MGR_REJECT', selected)">Refuser</button>
              <button class="btn primary" *ngIf="canManagerAct(selected)" (click)="openConfirm('MGR_APPROVE', selected)">Approuver</button>
              <button class="btn light" *ngIf="canRhAct(selected)" (click)="openConfirm('RH_REJECT', selected)">Refuser</button>
              <button class="btn primary" *ngIf="canRhAct(selected)" (click)="openConfirm('RH_APPROVE', selected)">Valider definitivement</button>
              <button class="btn danger-light" *ngIf="canRhCancel(selected)" (click)="openConfirm('RH_CANCEL', selected)">Annuler le congé</button>
            </footer>
          </div>
        </ng-container>

        <ng-container *ngSwitchCase="'BALANCES'">
          <div class="surface detail-surface balance-surface">
            <header class="surface-head">
              <h2>Soldes employés</h2>
              <button class="icon-btn ghost" type="button" (click)="closeView()" aria-label="Fermer"><app-icon name="x"></app-icon></button>
            </header>
            <div class="filters balance-filters" style="grid-template-columns: minmax(320px, 1fr) 96px; padding: 20px 24px 12px; border-bottom: 0;">
              <label class="search"><app-icon class="search-i" name="search"></app-icon><input [(ngModel)]="balanceSearch" placeholder="Rechercher un employé..." /></label>
              <select [(ngModel)]="selectedYear" (ngModelChange)="loadBalances()"><option *ngFor="let y of years" [value]="y">{{ y }}</option></select>
            </div>
            <div class="table-wrap" style="margin: 14px 24px 20px; border: 1px solid #d7e1ef; border-radius: 8px; overflow: hidden;">
              <table class="leave-table balance-table">
                <colgroup>
                  <col style="width: 20%" /><col style="width: 15%" /><col style="width: 16%" />
                  <col style="width: 13%" /><col style="width: 13%" /><col style="width: 23%" />
                </colgroup>
                <thead><tr><th style="text-align:left;padding:14px 20px;">Employé</th><th style="text-align:left;padding:14px 20px;">Département</th><th style="text-align:left;padding:14px 20px;">Solde annuel</th><th style="text-align:left;padding:14px 20px;">Utilisés</th><th style="text-align:left;padding:14px 20px;">Restants</th><th style="text-align:left;padding:14px 20px;">Progression</th></tr></thead>
                <tbody>
                  <tr *ngFor="let b of filteredBalances()">
                    <td style="text-align:left;padding:14px 20px;font-weight:650;">{{ userName(b.employeeId) }}</td>
                    <td style="text-align:left;padding:14px 20px;">{{ b.employee?.departement || '-' }}</td>
                    <td style="text-align:left;padding:14px 20px;">{{ b.soldeAnnuel }} j</td>
                    <td style="text-align:left;padding:14px 20px;">{{ b.joursUtilises }} j</td>
                    <td style="text-align:left;padding:14px 20px;"><b class="ok" style="font-weight:650;">{{ b.joursRestants }} j</b></td>
                    <td style="text-align:left;padding:14px 20px;white-space:nowrap;"><div class="progress"><span [style.width.%]="progressPct(b)"></span></div><small>{{ progressPct(b) }}%</small></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </ng-container>

        <ng-container *ngSwitchCase="'HOLIDAYS'">
          <div class="surface detail-surface">
            <header class="surface-head">
              <h2>Configuration des jours fériés</h2>
              <button class="icon-btn ghost" type="button" (click)="closeView()" aria-label="Fermer"><app-icon name="x"></app-icon></button>
            </header>
            <div class="filters holiday-actions">
              <select [(ngModel)]="holidayYear" (ngModelChange)="loadHolidays()"><option *ngFor="let y of years" [value]="y">{{ y }}</option></select>
              <button class="btn light sync-btn" (click)="syncHolidays()"><app-icon name="refresh"></app-icon> Synchroniser</button>
              <button class="btn primary add-btn" (click)="startHolidayEdit()"><app-icon name="plus"></app-icon> Ajouter</button>
            </div>
            <div class="table-wrap">
              <table class="leave-table">
                <thead><tr><th>Date</th><th>Nom</th><th>Type</th><th>Source</th><th>Action</th></tr></thead>
                <tbody>
                  <tr *ngFor="let h of holidays">
                    <td>{{ h.date }}</td>
                    <td><b>{{ h.name }}</b></td>
                    <td>{{ holidayKindLabel(h.kind) }}</td>
                    <td><span class="source" [ngClass]="h.source.toLowerCase()">{{ h.source }}</span></td>
                    <td><button class="icon-btn" [disabled]="h.locked || h.kind === 'NATIONAL'" (click)="startHolidayEdit(h)"><app-icon name="edit"></app-icon></button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </ng-container>

        <ng-container *ngSwitchDefault>
          <header class="page-head" *ngIf="role !== 'RH'">
            <h1>{{ pageTitle() }}</h1>
            <button class="btn primary" (click)="openCreate()"><app-icon name="plus"></app-icon> Nouvelle demande</button>
          </header>

          <div class="stats-grid" [class.rh]="role === 'RH'">
            <article class="stat" *ngFor="let s of stats()">
              <div><span>{{ s.label }}</span><strong>{{ s.value }}</strong><small>{{ s.help }}</small></div>
              <span class="stat-icon" [ngClass]="s.tone"><app-icon [name]="s.icon"></app-icon></span>
            </article>
          </div>

          <section class="surface" *ngIf="role === 'MANAGER'">
            <div class="section-head">
              <h2>Mes demandes personnelles <span>{{ mine.length }}</span></h2>
              <small>Superieur: {{ managerLabel(auth.user?.id || 0) || 'RH direct' }}</small>
            </div>
            <div class="table-wrap compact-table">
              <table class="leave-table">
                <thead><tr><th>Référence</th><th>Type</th><th>Période</th><th>Jours</th><th>Statut</th><th>Actions</th></tr></thead>
                <tbody>
                  <tr *ngFor="let r of mine">
                    <td>{{ ref(r) }}</td><td>{{ typeLabel(r.typeConge) }}</td><td>{{ formatPeriod(r) }}</td><td>{{ r.nbJours }} j</td>
                    <td><span class="badge" [ngClass]="statusClass(r.statut)">{{ statusLabel(r.statut) }}</span></td>
                    <td class="actions"><button class="icon-btn" (click)="openDetail(r)"><app-icon name="eye"></app-icon></button><button class="icon-btn danger" *ngIf="canEmployeeCancel(r)" (click)="openConfirm('EMP_CANCEL', r)"><app-icon name="x"></app-icon></button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section class="surface">
            <div class="filters" [class.rh-filters]="role === 'RH'">
              <label class="search"><app-icon class="search-i" name="search"></app-icon><input [(ngModel)]="filters.search" [placeholder]="role === 'RH' ? 'Rechercher employé ou matricule...' : role === 'MANAGER' ? 'Rechercher un collaborateur...' : 'Rechercher une référence, un type...'" /></label>
              <select [(ngModel)]="filters.status"><option value="ALL">Tous statuts</option><option *ngFor="let s of statuses" [value]="s.value">{{ s.label }}</option></select>
              <select [(ngModel)]="filters.type"><option value="ALL">Tous types</option><option *ngFor="let t of leaveTypes" [value]="t.value">{{ t.label }}</option></select>
              <select *ngIf="role === 'RH'" [(ngModel)]="filters.managerId">
                <option value="ALL">Tous managers</option>
                <option *ngFor="let m of managerOptions()" [value]="m.id">{{ userName(m.id) }}</option>
              </select>
              <select [(ngModel)]="selectedYear"><option *ngFor="let y of years" [value]="y">{{ y }}</option></select>
              <button class="btn light" *ngIf="role === 'RH'" (click)="openBalances()"><app-icon name="users"></app-icon> Consulter soldes</button>
              <button class="btn light icon-only" *ngIf="role === 'RH'" (click)="openHolidays()" title="Jours fériés" aria-label="Jours fériés"><app-icon name="calendar"></app-icon></button>
            </div>
            <div class="table-wrap">
              <table class="leave-table">
                <thead>
                  <tr *ngIf="role === 'RH'"><th>Employé</th><th>Département</th><th>Type</th><th>Période</th><th>Jours</th><th>Manager</th><th>Statut</th><th>Actions</th></tr>
                  <tr *ngIf="role === 'MANAGER'"><th>Collaborateur</th><th>Type</th><th>Période</th><th>Jours</th><th>Solde</th><th>Statut</th><th>Actions</th></tr>
                  <tr *ngIf="role === 'EMPLOYEE'"><th>Référence</th><th>Type</th><th>Période</th><th>Jours</th><th>Statut</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  <tr *ngFor="let r of filteredRows()">
                    <ng-container *ngIf="role === 'RH'">
                      <td>
                        <span class="person-cell">
                          <span class="avatar">{{ initials(r.employeeId) }}</span>
                          <span><b>{{ userName(r.employeeId) }}</b><small>{{ employeeSubline(r.employeeId) }}</small></span>
                        </span>
                      </td>
                      <td>{{ userDept(r.employeeId) }}</td>
                      <td>{{ typeLabel(r.typeConge) }}</td>
                      <td>{{ formatPeriod(r) }}</td>
                      <td>{{ r.nbJours }} j</td>
                      <td>{{ r.managerId ? userName(r.managerId) : 'RH direct' }}</td>
                      <td><span class="badge" [ngClass]="statusClass(r.statut)">{{ statusLabel(r.statut) }}</span></td>
                    </ng-container>
                    <ng-container *ngIf="role === 'MANAGER'">
                      <td>
                        <span class="person-cell">
                          <span class="avatar">{{ initials(r.employeeId) }}</span>
                          <span><b>{{ userName(r.employeeId) }}</b><small>{{ userPoste(r.employeeId) }}</small></span>
                        </span>
                      </td>
                      <td>{{ typeLabel(r.typeConge) }}</td>
                      <td>{{ formatPeriod(r) }}</td>
                      <td>{{ r.nbJours }} j</td>
                      <td>{{ employeeBalanceText(r.employeeId) }}</td>
                      <td><span class="badge" [ngClass]="statusClass(r.statut)">{{ statusLabel(r.statut) }}</span></td>
                    </ng-container>
                    <ng-container *ngIf="role === 'EMPLOYEE'">
                      <td>{{ ref(r) }}</td>
                      <td>{{ typeLabel(r.typeConge) }}</td>
                      <td>{{ formatPeriod(r) }}</td>
                      <td>{{ r.nbJours }} j</td>
                      <td><span class="badge" [ngClass]="statusClass(r.statut)">{{ statusLabel(r.statut) }}</span></td>
                    </ng-container>
                    <td class="actions">
                      <button class="icon-btn" (click)="openDetail(r)"><app-icon name="eye"></app-icon></button>
                      <button class="icon-btn ok" *ngIf="canManagerAct(r)" (click)="openConfirm('MGR_APPROVE', r)"><app-icon name="check"></app-icon></button>
                      <button class="icon-btn danger" *ngIf="canManagerAct(r)" (click)="openConfirm('MGR_REJECT', r)"><app-icon name="x"></app-icon></button>
                      <button class="icon-btn ok" *ngIf="canRhAct(r)" (click)="openConfirm('RH_APPROVE', r)"><app-icon name="check"></app-icon></button>
                      <button class="icon-btn danger" *ngIf="canRhAct(r)" (click)="openConfirm('RH_REJECT', r)"><app-icon name="x"></app-icon></button>
                      <button class="icon-btn danger" *ngIf="canEmployeeCancel(r)" (click)="openConfirm('EMP_CANCEL', r)"><app-icon name="x"></app-icon></button>
                    </td>
                  </tr>
                  <tr *ngIf="filteredRows().length === 0"><td class="empty" [attr.colspan]="role === 'RH' ? 8 : role === 'MANAGER' ? 7 : 6">Aucune demande trouvée.</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </ng-container>
      </ng-container>

      <div class="confirm-backdrop" *ngIf="confirmAction">
        <div class="confirm">
          <header><h3>{{ confirmTitle() }}</h3><button class="icon-btn ghost" (click)="closeConfirm()"><app-icon name="x"></app-icon></button></header>
          <p>Confirmer l'action sur la demande {{ confirmTarget ? ref(confirmTarget) : '' }}.</p>
          <label><span>Commentaire</span><textarea rows="4" [(ngModel)]="confirmComment" placeholder="Ajouter un commentaire..."></textarea></label>
          <footer><button class="btn light" (click)="closeConfirm()">Annuler</button><button class="btn primary" [class.reject]="confirmAction.includes('REJECT')" (click)="confirm()">Confirmer</button></footer>
        </div>
      </div>

      <div class="confirm-backdrop" *ngIf="holidayDraft">
        <div class="confirm holiday-modal">
          <header>
            <h3>{{ holidayDraft.id ? 'Modifier le jour férié' : 'Ajouter un jour férié' }}</h3>
            <button class="icon-btn ghost" type="button" (click)="holidayDraft = null" aria-label="Fermer"><app-icon name="x"></app-icon></button>
          </header>
          <div class="holiday-modal-body">
            <label>
              <span>Date</span>
              <input type="date" [(ngModel)]="holidayDraft.date" />
            </label>
            <label>
              <span>Nom</span>
              <input [(ngModel)]="holidayDraft.name" placeholder="Nom du jour férié" />
            </label>
            <label>
              <span>Type</span>
              <select [(ngModel)]="holidayDraft.kind">
                <option value="RELIGIOUS">Religieux</option>
                <option value="COMPANY">Exceptionnel</option>
              </select>
            </label>
          </div>
          <footer>
            <button class="btn light" type="button" (click)="holidayDraft = null">Annuler</button>
            <button class="btn primary" type="button" (click)="saveHoliday()">Enregistrer</button>
          </footer>
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .leave-page { font-family: Inter, "Inter var", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #06142b; min-height: calc(100vh - 32px); overflow-x: hidden; font-size: 14px; font-weight: 500; }
    .leave-page * { box-sizing: border-box; }
    .leave-page ::-webkit-scrollbar { width: 4px; height: 0; }
    .leave-page ::-webkit-scrollbar-thumb { background: transparent; }
    .page-head { display: flex; align-items: center; justify-content: space-between; margin: 0 0 18px; }
    h1 { margin: 0; font-size: 24px; line-height: 1.2; font-weight: 600; color: #0f172a; }
    h2 { margin: 0; font-size: 16px; line-height: 1.25; font-weight: 760; color: #020817; }
    h3 { margin: 0 0 12px; font-size: 12px; text-transform: uppercase; color: #3b5476; font-weight: 650; }
    .btn { border: 1px solid #d7e1ef; border-radius: 8px; height: 38px; padding: 0 14px; display: inline-flex; gap: 8px; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; cursor: pointer; background: #fff; color: #0b1730; white-space: nowrap; }
    .btn.icon-only { width: 42px; min-width: 42px; padding: 0; }
    app-icon { color: currentColor; }
    .btn.primary { background: #2563eb; border-color: #2563eb; color: #fff; }
    .btn.light { background: #fff; color: #334155; }
    .btn.danger-light { color: #e11d48; border-color: #fecdd3; background: #fff; }
    .btn.reject { background: #e11d48; border-color: #e11d48; color: #fff; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
    .stats-grid.rh { grid-template-columns: repeat(6, minmax(0, 1fr)); }
    .stat { min-height: 106px; background: #fff; border: 1px solid #d7e1ef; border-radius: 12px; padding: 18px 16px; display: flex; justify-content: space-between; align-items: flex-start; box-shadow: 0 1px 0 rgba(15, 23, 42, .02); }
    .stat > div > span { display: block; color: #334967; text-transform: uppercase; font-size: 11px; font-weight: 650; }
    .stat strong { display: block; font-size: 26px; margin-top: 20px; font-weight: 780; color: #020817; }
    .stat small { color: #64748b; font-size: 12px; }
    .stat-icon { width: 34px; height: 34px; border-radius: 9px; display: grid; place-items: center; flex: 0 0 34px; position: relative; }
    .stat-icon app-icon { width: 17px; height: 17px; display: inline-grid; place-items: center; position: absolute; inset: 0; margin: auto; }
    .stat-icon.blue { background: #dbeafe; color: #2563eb; }
    .stat-icon.green { background: #dcfce7; color: #059669; }
    .stat-icon.red { background: #ffe4e6; color: #e11d48; }
    .stat-icon.orange { background: #ffedd5; color: #ea580c; }
    .stat-icon.purple { background: #ede9fe; color: #7c3aed; }
    .surface { background: #fff; border: 1px solid #d7e1ef; border-radius: 12px; margin-bottom: 20px; overflow: hidden; }
    .surface-head { display: flex; justify-content: space-between; align-items: center; min-height: 66px; padding: 16px 24px; border-bottom: 1px solid #e1e8f2; }
    .detail-surface { min-height: calc(100vh - 54px); }
    .section-head { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-bottom: 1px solid #e2e8f0; }
    .section-head h2 span { background: #eef2f7; color: #64748b; border-radius: 999px; padding: 2px 8px; font-size: 12px; margin-left: 6px; }
    .filters { display: grid; grid-template-columns: minmax(260px, 1fr) 160px 150px 120px auto auto; gap: 8px; padding: 12px; border-bottom: 1px solid #e1e8f2; align-items: center; }
    .filters.rh-filters { grid-template-columns: minmax(280px, 1fr) 124px 124px 144px 110px auto 42px; }
    .filters select, .filters input, .leave-form input, .leave-form select, .leave-form textarea, .holiday-modal input, .holiday-modal select { height: 38px; border: 1px solid #d7e1ef; border-radius: 8px; padding: 0 12px; font: inherit; font-size: 13px; font-weight: 500; outline: none; background: #fff; width: 100%; color: #06142b; }
    .filters select:focus, .filters input:focus, .leave-form input:focus, .leave-form select:focus, .leave-form textarea:focus, .holiday-modal input:focus, .holiday-modal select:focus { border-color: #93c5fd; box-shadow: 0 0 0 3px rgba(37, 99, 235, .08); }
    .leave-form textarea, .confirm textarea { height: auto; padding: 12px; resize: vertical; }
    .search { position: relative; display: block; }
    .search .search-i { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #64748b; }
    .search input { padding-left: 38px; }
    .table-wrap { overflow: visible; max-height: none; }
    .leave-table { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; }
    .leave-table th { background: #f8fafc; color: #304969; text-transform: uppercase; font-size: 11px; font-weight: 650; text-align: center; padding: 12px 10px; border-bottom: 1px solid #e1e8f2; }
    .leave-table td { text-align: center; vertical-align: middle; padding: 18px 10px; border-bottom: 1px solid #e1e8f2; font-size: 13px; font-weight: 500; color: #020817; overflow-wrap: normal; word-break: normal; }
    .leave-table td:first-child, .leave-table th:first-child { text-align: left; padding-left: 20px; }
    .leave-table small { display: block; color: #64748b; font-weight: 500; margin-top: 3px; }
    .person-cell { display: inline-flex; align-items: center; gap: 12px; min-width: 0; max-width: 100%; text-align: left; }
    .avatar { width: 36px; height: 36px; flex: 0 0 36px; border-radius: 50%; display: grid; place-items: center; background: #dbeafe; color: #2563eb; font-size: 12px; font-weight: 650; }
    .person-cell > span:last-child { min-width: 0; }
    .person-cell b { display: block; font-weight: 720; line-height: 1.2; white-space: normal; overflow-wrap: normal; word-break: normal; }
    .leave-table td.actions { display: table-cell; text-align: center; white-space: nowrap; }
    .leave-table td.actions .icon-btn { margin: 0 3px; vertical-align: middle; }
    .icon-btn { width: 32px; height: 32px; border: 1px solid #bfdbfe; background: #fff; color: #2563eb; border-radius: 8px; display: inline-grid; place-items: center; cursor: pointer; }
    .icon-btn app-icon { width: 16px; height: 16px; }
    .icon-btn.ok { color: #059669; border-color: #bbf7d0; }
    .icon-btn.danger { color: #e11d48; border-color: #fecdd3; }
    .icon-btn.ghost { color: #64748b; border-color: #dbe3ef; }
    .icon-btn:disabled { opacity: .45; cursor: not-allowed; }
    .badge { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-width: 86px; border-radius: 999px; padding: 5px 10px; font-size: 12px; font-weight: 700; line-height: 1.2; }
    .badge::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .st-pending-rh, .st-pending-manager { background: #dff2ff; color: #0369a1; }
    .st-pending-manager { background: #ffedd5; color: #b45309; }
    .st-approved { background: #dcfce7; color: #047857; }
    .st-refused { background: #ffe4e6; color: #be123c; }
    .st-cancelled { background: #f1f5f9; color: #64748b; }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .leave-form { padding: 20px 24px 24px; display: grid; gap: 16px; }
    .leave-form label, .confirm label, .file-field { display: grid; gap: 7px; color: #263b5d; font-size: 12px; font-weight: 680; }
    .file-input-row { height: 38px; border: 1px solid #d7e1ef; border-radius: 8px; display: flex; align-items: center; gap: 12px; padding: 0 12px; background: #fff; }
    .file-picker { display: inline-flex !important; align-items: center; justify-content: center; height: 30px; padding: 0 12px; border-radius: 8px; background: #eff6ff; color: #2563eb; font-weight: 650; cursor: pointer; }
    .file-picker input { display: none; }
    .file-input-row em { font-style: normal; color: #020817; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .notice { margin: 20px 24px 0; border: 1px solid #bfdbfe; color: #1d4ed8; background: #eff6ff; border-radius: 8px; padding: 10px 14px; font-size: 13px; }
    .calc-box { border: 1px solid #d7e1ef; border-radius: 10px; padding: 14px 16px; margin: 20px 24px 0; background: #fff; }
    .leave-form .calc-box { margin: 0; }
    .calc-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
    .calc-grid div { border: 1px solid #d7e1ef; border-radius: 8px; padding: 14px 12px; min-height: 72px; background: #fff; }
    .calc-grid div.accent { border-color: #93c5fd; color: #2563eb; }
    .calc-grid span { display: block; text-transform: uppercase; letter-spacing: .04em; color: #475569; font-size: 10px; font-weight: 650; margin-bottom: 9px; }
    .calc-grid b { font-size: 18px; }
    .detail-meta { padding: 20px 24px 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px 28px; }
    .detail-meta > div > span:not(.badge) { display: block; color: #3b5476; text-transform: uppercase; font-size: 11px; font-weight: 680; margin-bottom: 6px; }
    .detail-meta b, .detail-meta a { font-size: 14px; font-weight: 720; color: #020817; }
    .detail-meta a { color: #2563eb; }
    .timeline { padding: 22px 24px; }
    .tl-row { display: flex; gap: 12px; position: relative; padding-bottom: 18px; }
    .tl-row:not(:last-child)::before { content: ''; position: absolute; left: 7px; top: 16px; bottom: 0; width: 1px; background: #dbe3ef; }
    .tl-dot { width: 14px; height: 14px; border-radius: 50%; background: #2f80ed; margin-top: 2px; flex: 0 0 auto; }
    .tl-row b { font-size: 14px; }
    .tl-row p { margin: 4px 0; color: #64748b; font-size: 12px; }
    .tl-row em { color: #334155; font-size: 12px; }
    .form-actions { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 0 0; border-top: 1px solid #e2e8f0; }
    .leave-form > .form-actions { margin: 0 -24px; padding: 16px 24px 0; }
    .detail-actions { margin: 0; padding: 16px 24px 24px; }
    .error-msg { color: #e11d48; font-weight: 650; font-size: 13px; }
    .progress { width: 130px; height: 6px; border-radius: 999px; background: #eef2f7; display: inline-block; vertical-align: middle; margin-right: 8px; overflow: hidden; }
    .progress span { display: block; height: 100%; background: #2f80ed; border-radius: inherit; }
    .ok { color: #047857; }
    .source { border-radius: 999px; padding: 4px 8px; font-size: 12px; font-weight: 650; }
    .source.calendarific { background: #dbeafe; color: #1d4ed8; }
    .source.fallback { background: #eef2f7; color: #475569; }
    .source.manual { background: #ffedd5; color: #c2410c; }
    .holiday-actions { grid-template-columns: 110px minmax(220px, 1fr) auto auto; }
    .confirm-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, .28); z-index: 1000; display: grid; place-items: center; }
    .confirm { width: 440px; max-width: calc(100vw - 32px); background: #fff; border-radius: 12px; box-shadow: 0 20px 60px rgba(15,23,42,.2); overflow: hidden; }
    .confirm header, .confirm footer { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-bottom: 1px solid #e2e8f0; }
    .confirm footer { border-top: 1px solid #e2e8f0; border-bottom: 0; justify-content: flex-end; gap: 8px; }
    .confirm p, .confirm label { margin: 16px 20px; }
    .holiday-modal { width: 560px; }
    .holiday-modal-body { padding: 18px 20px; display: grid; gap: 12px; }
    .holiday-modal-body label { display: grid; gap: 7px; color: #263b5d; font-size: 12px; font-weight: 680; margin: 0; }
    td.empty { text-align: center !important; font-style: italic; color: #516a87 !important; padding: 40px !important; font-weight: 400 !important; font-size: 14px; }
    @media (max-width: 1180px) { .stats-grid, .stats-grid.rh { grid-template-columns: repeat(2, minmax(0, 1fr)); } .filters, .filters.rh-filters { grid-template-columns: 1fr 1fr; } .calc-grid, .detail-meta { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 760px) { .form-grid, .calc-grid, .detail-meta { grid-template-columns: 1fr; } .page-head { align-items: flex-start; gap: 12px; flex-direction: column; } .table-wrap { max-height: none; } }
  `],
})
export class LeavesComponent implements OnInit {
  role: Role | null = null;
  viewMode: ViewMode = 'MAIN';
  mine: LeaveRequest[] = [];
  teamRows: LeaveRequest[] = [];
  rhRows: LeaveRequest[] = [];
  users: UserRow[] = [];
  usersMap = new Map<number, UserRow>();
  balances = new Map<number, BalanceRow>();
  balanceRows: BalanceRow[] = [];
  holidays: PublicHoliday[] = [];
  private holidayCache = new Map<number, PublicHoliday[]>();
  historyRows: LeaveHistory[] = [];
  selected: LeaveRequest | null = null;
  selectedYear = new Date().getFullYear();
  holidayYear = new Date().getFullYear();
  years = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1];
  currentBalance: BalanceRow | null = null;
  formError = '';
  selectedFile: File | null = null;
  balanceSearch = '';
  holidayDraft: any = null;
  confirmAction: ConfirmAction | null = null;
  confirmTarget: LeaveRequest | null = null;
  confirmComment = '';
  filters = { search: '', status: 'ALL', type: 'ALL', managerId: 'ALL' };

  leaveTypes = [
    { value: 'ANNUEL', label: 'Annuel' },
    { value: 'MALADIE', label: 'Maladie' },
    { value: 'MATERNITE', label: 'Maternite' },
    { value: 'PATERNITE_NAISSANCE', label: 'Paternite / naissance' },
    { value: 'MARIAGE_SALARIE', label: 'Mariage salarie' },
    { value: 'MARIAGE_ENFANT', label: 'Mariage enfant' },
    { value: 'DECES', label: 'Deces' },
    { value: 'SANS_SOLDE', label: 'Sans solde' },
  ];
  statuses = [
    { value: 'EN_ATTENTE_MANAGER', label: 'En attente manager' },
    { value: 'EN_ATTENTE_RH', label: 'En attente RH' },
    { value: 'APPROUVE', label: 'Approuvé' },
    { value: 'REFUSE', label: 'Refusé' },
    { value: 'ANNULE', label: 'Annulé' },
  ];
  draft = { typeConge: 'ANNUEL', dateDebut: '', dateFin: '', motif: '' };
  draftCalc = { joursCalendaires: 0, weekendsExclus: 0, joursFeriesExclus: 0, joursOuvres: 0 };

  constructor(readonly auth: AuthService, private readonly http: HttpClient, private readonly route: ActivatedRoute) { }

  ngOnInit(): void {
    this.role = this.auth.user?.role as Role;
    this.loadAll();
  }

  loadAll(): void {
    const requests: any = {
      users: this.http.get<UserRow[]>(`${environment.apiUrl}/api/users`).pipe(catchError(() => of([]))),
      mine: this.http.get<LeaveRequest[]>(`${environment.apiUrl}/api/leaves/my`).pipe(catchError(() => of([]))),
      balance: this.http.get<BalanceRow>(`${environment.apiUrl}/api/leaves/balances/me`).pipe(catchError(() => of(null))),
    };
    if (this.role === 'MANAGER') {
      requests.team = this.http.get<LeaveRequest[]>(`${environment.apiUrl}/api/leaves/manager/search`).pipe(catchError(() => of([])));
    }
    if (this.role === 'RH') {
      requests.rh = this.http.get<LeaveRequest[]>(`${environment.apiUrl}/api/leaves/rh/search`).pipe(catchError(() => of([])));
    }
    forkJoin(requests).subscribe((data: any) => {
      this.users = data.users || [];
      this.usersMap = new Map(this.users.map((u) => [u.id, u]));
      const current = this.auth.user;
      if (current && !this.usersMap.has(current.id)) {
        this.usersMap.set(current.id, { id: current.id, nom: current.nom, prenom: current.prenom, role: current.role as Role });
      }
      this.mine = data.mine || [];
      this.currentBalance = data.balance || null;
      this.teamRows = data.team || [];
      this.rhRows = data.rh || [];
      this.loadKnownBalances();
      this.checkViewId();
    });
  }

  private checkViewId(): void {
    const viewId = this.route.snapshot.queryParams['viewId'];
    if (viewId) {
      const id = Number(viewId);
      const sheet = this.mine.find(s => s.id === id) || this.teamRows.find(s => s.id === id) || this.rhRows.find(s => s.id === id);
      if (sheet) this.openDetail(sheet);
    }
  }

  loadKnownBalances(): void {
    const ids = Array.from(new Set([...this.mine, ...this.teamRows, ...this.rhRows].map((r) => r.employeeId)));
    ids.forEach((id) => {
      if (!this.balances.has(id)) {
        this.http.get<BalanceRow>(`${environment.apiUrl}/api/leaves/balances/employee/${id}`).pipe(catchError(() => of(null))).subscribe((b) => {
          if (b) this.balances.set(id, { ...b, employee: this.usersMap.get(id) });
        });
      }
    });
  }

  rows(): LeaveRequest[] {
    if (this.role === 'RH') return this.rhRows;
    if (this.role === 'MANAGER') return this.teamRows;
    return this.mine;
  }

  filteredRows(): LeaveRequest[] {
    const q = this.filters.search.trim().toLowerCase();
    return this.rows().filter((r) => {
      const blob = `${this.ref(r)} ${this.typeLabel(r.typeConge)} ${this.userName(r.employeeId)} ${this.userMatricule(r.employeeId)}`.toLowerCase();
      return (!q || blob.includes(q))
        && (this.filters.status === 'ALL' || r.statut === this.filters.status)
        && (this.filters.type === 'ALL' || r.typeConge === this.filters.type)
        && (this.filters.managerId === 'ALL' || String(r.managerId || '') === String(this.filters.managerId))
        && (!r.dateDebut || Number(r.dateDebut.slice(0, 4)) === Number(this.selectedYear));
    });
  }

  stats(): any[] {
    if (this.role === 'RH') {
      const rows = this.rhRows;
      const done = rows.filter((r) => r.statut === 'APPROUVE' || r.statut === 'REFUSE');
      const approved = rows.filter((r) => r.statut === 'APPROUVE').length;
      return [
        { label: 'En attente RH', value: rows.filter((r) => r.statut === 'EN_ATTENTE_RH').length, help: '', icon: 'clock', tone: 'blue' },
        { label: 'Approuvées', value: approved, help: '', icon: 'check', tone: 'green' },
        { label: 'Refusées', value: rows.filter((r) => r.statut === 'REFUSE').length, help: '', icon: 'x', tone: 'red' },
        { label: 'Annulées', value: rows.filter((r) => r.statut === 'ANNULE').length, help: '', icon: 'calendar', tone: 'blue' },
        { label: 'À venir', value: rows.filter((r) => r.statut === 'APPROUVE' && r.dateFin >= this.today()).length, help: '', icon: 'calendar', tone: 'purple' },
        { label: "Taux d'acceptation", value: done.length ? Math.round((approved / done.length) * 100) + '%' : '0%', help: '', icon: 'file', tone: 'orange' },
      ];
    }
    if (this.role === 'MANAGER') {
      return [
        { label: 'Equipe', value: this.users.filter((u) => u.managerId === this.auth.user?.id).length, help: 'collaborateurs', icon: 'users', tone: 'blue' },
        { label: 'A valider', value: this.teamRows.filter((r) => r.statut === 'EN_ATTENTE_MANAGER').length, help: 'demandes', icon: 'clock', tone: 'orange' },
        { label: 'Approuvées', value: this.teamRows.filter((r) => r.statut === 'APPROUVE').length, help: 'cycle ' + this.selectedYear, icon: 'check', tone: 'green' },
        { label: 'Refusées', value: this.teamRows.filter((r) => r.statut === 'REFUSE').length, help: 'cumulées', icon: 'x', tone: 'red' },
      ];
    }
    return [
      { label: 'Solde annuel', value: (this.currentBalance?.soldeAnnuel || 26) + ' j', help: 'Annee ' + this.selectedYear, icon: 'calendar', tone: 'blue' },
      { label: 'Utilisés', value: (this.currentBalance?.joursUtilises || 0) + ' j', help: 'Cumulés', icon: 'file', tone: 'purple' },
      { label: 'Restants', value: (this.currentBalance?.joursRestants || 26) + ' j', help: 'Disponibles', icon: 'check', tone: 'green' },
      { label: 'En attente', value: this.mine.filter((r) => r.statut.includes('ATTENTE')).length, help: 'Demandes', icon: 'clock', tone: 'orange' },
    ];
  }

  openCreate(): void {
    this.formError = '';
    this.selectedFile = null;
    this.draft = { typeConge: 'ANNUEL', dateDebut: '', dateFin: '', motif: '' };
    this.draftCalc = { joursCalendaires: 0, weekendsExclus: 0, joursFeriesExclus: 0, joursOuvres: 0 };
    this.loadPublicHolidayYears([this.selectedYear]);
    this.viewMode = 'CREATE';
  }

  openDetail(r: LeaveRequest): void {
    this.selected = r;
    this.viewMode = 'DETAIL';
    this.http.get<LeaveRequest>(`${environment.apiUrl}/api/leaves/${r.id}`).pipe(catchError(() => of(r))).subscribe((detail) => this.selected = detail);
    this.http.get<LeaveHistory[]>(`${environment.apiUrl}/api/leaves/${r.id}/history`).pipe(catchError(() => of([]))).subscribe((h) => {
      this.historyRows = h;
      this.loadMissingUsers(h.map((row) => row.actorId).filter((id): id is number => !!id));
    });
  }

  closeView(): void {
    this.viewMode = 'MAIN';
    this.selected = null;
    this.historyRows = [];
    this.holidayDraft = null;
    this.loadAll();
  }

  submitCreate(): void {
    this.formError = '';
    if (!this.draft.dateDebut || !this.draft.dateFin) {
      this.formError = 'Veuillez renseigner les dates.';
      return;
    }
    if (this.attachmentRequired(this.draft.typeConge) && !this.selectedFile) {
      this.formError = 'Justificatif obligatoire pour ce type de congé.';
      return;
    }
    const fd = new FormData();
    fd.append('typeConge', this.draft.typeConge);
    fd.append('dateDebut', this.draft.dateDebut);
    fd.append('dateFin', this.draft.dateFin);
    fd.append('motif', this.draft.motif || '');
    if (this.selectedFile) fd.append('justificatif', this.selectedFile);
    this.http.post(`${environment.apiUrl}/api/leaves`, fd).subscribe({
      next: () => this.closeView(),
      error: (e) => this.formError = e?.error?.error || 'Erreur lors de la soumission.',
    });
  }

  onFilePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] || null;
  }

  recalculateDraft(): void {
    if (!this.draft.dateDebut || !this.draft.dateFin || this.draft.dateFin < this.draft.dateDebut) {
      this.draftCalc = { joursCalendaires: 0, weekendsExclus: 0, joursFeriesExclus: 0, joursOuvres: 0 };
      return;
    }
    const years = this.yearsBetween(this.draft.dateDebut, this.draft.dateFin);
    const missing = years.filter((year) => !this.holidayCache.has(year));
    if (missing.length) {
      this.loadPublicHolidayYears(missing, () => this.recalculateDraft());
      return;
    }
    const start = new Date(this.draft.dateDebut + 'T00:00:00');
    const end = new Date(this.draft.dateFin + 'T00:00:00');
    const holidays = new Set(
      years
        .flatMap((year) => this.holidayCache.get(year) || [])
        .filter((h) => h.active)
        .map((h) => h.date)
    );
    let joursCalendaires = 0, weekendsExclus = 0, joursFeriesExclus = 0, joursOuvres = 0;
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = this.localDateIso(d);
      joursCalendaires++;
      if (d.getDay() === 0 || d.getDay() === 6) weekendsExclus++;
      else if (holidays.has(iso)) joursFeriesExclus++;
      else joursOuvres++;
    }
    this.draftCalc = { joursCalendaires, weekendsExclus, joursFeriesExclus, joursOuvres };
  }

  openBalances(): void {
    this.viewMode = 'BALANCES';
    this.loadBalances();
  }

  loadBalances(): void {
    const employees = this.users.filter((u) => u.role !== 'ADMIN' && u.role !== 'RH');
    const calls = employees.map((u) => this.http.get<BalanceRow>(`${environment.apiUrl}/api/leaves/balances/employee/${u.id}?annee=${this.selectedYear}`).pipe(catchError(() => of(null))));
    forkJoin(calls).subscribe((rows) => this.balanceRows = rows.map((b, i) => b ? { ...b, employee: employees[i] } : null).filter(Boolean) as BalanceRow[]);
  }

  openHolidays(): void {
    this.viewMode = 'HOLIDAYS';
    this.loadHolidays();
  }

  loadHolidays(): void {
    this.http.get<PublicHoliday[]>(`${environment.apiUrl}/api/leaves/rh/holidays?year=${this.holidayYear}`).pipe(catchError(() => of([]))).subscribe((r) => {
      this.holidays = r;
      this.holidayCache.set(Number(this.holidayYear), r);
      this.recalculateDraft();
    });
  }

  private loadPublicHolidayYears(years: number[], after?: () => void): void {
    const missing = Array.from(new Set(years.map(Number).filter((year) => !this.holidayCache.has(year))));
    if (!missing.length) {
      after?.();
      return;
    }
    const calls = missing.map((year) =>
      this.http.get<PublicHoliday[]>(`${environment.apiUrl}/api/leaves/holidays?year=${year}`)
        .pipe(catchError(() => of([] as PublicHoliday[])))
    );
    forkJoin(calls).subscribe((rows) => {
      rows.forEach((items, index) => this.holidayCache.set(missing[index], items || []));
      after?.();
    });
  }

  private yearsBetween(startIso: string, endIso: string): number[] {
    const startYear = Number(startIso.slice(0, 4));
    const endYear = Number(endIso.slice(0, 4));
    const years: number[] = [];
    for (let year = startYear; year <= endYear; year++) years.push(year);
    return years;
  }

  private localDateIso(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  syncHolidays(): void {
    this.http.post<PublicHoliday[]>(`${environment.apiUrl}/api/leaves/rh/holidays/sync`, {}).subscribe(() => this.loadHolidays());
  }

  startHolidayEdit(h?: PublicHoliday): void {
    this.holidayDraft = h ? { ...h } : { date: this.today(), name: '', kind: 'RELIGIOUS', active: true };
  }

  saveHoliday(): void {
    if (!this.holidayDraft?.date || !this.holidayDraft?.name) return;
    const payload = { date: this.holidayDraft.date, name: this.holidayDraft.name, kind: this.holidayDraft.kind, active: true };
    const req = this.holidayDraft.id
      ? this.http.put(`${environment.apiUrl}/api/leaves/rh/holidays/${this.holidayDraft.id}`, payload)
      : this.http.post(`${environment.apiUrl}/api/leaves/rh/holidays`, payload);
    req.subscribe(() => { this.holidayDraft = null; this.loadHolidays(); });
  }

  openConfirm(action: ConfirmAction, target: LeaveRequest): void {
    this.confirmAction = action;
    this.confirmTarget = target;
    this.confirmComment = '';
  }

  closeConfirm(): void {
    this.confirmAction = null;
    this.confirmTarget = null;
    this.confirmComment = '';
  }

  confirm(): void {
    if (!this.confirmAction || !this.confirmTarget) return;
    const id = this.confirmTarget.id;
    const body = { commentaire: this.confirmComment };
    const url: Record<ConfirmAction, string> = {
      EMP_CANCEL: `${environment.apiUrl}/api/leaves/${id}/cancel`,
      MGR_APPROVE: `${environment.apiUrl}/api/leaves/${id}/manager/approve`,
      MGR_REJECT: `${environment.apiUrl}/api/leaves/${id}/manager/reject`,
      RH_APPROVE: `${environment.apiUrl}/api/leaves/${id}/rh/approve`,
      RH_REJECT: `${environment.apiUrl}/api/leaves/${id}/rh/reject`,
      RH_CANCEL: `${environment.apiUrl}/api/leaves/${id}/rh/cancel`,
    };
    this.http.post(url[this.confirmAction], body).subscribe(() => {
      this.closeConfirm();
      this.closeView();
    });
  }

  canEmployeeCancel(r: LeaveRequest): boolean {
    return (this.role === 'EMPLOYEE' || this.role === 'MANAGER') && r.employeeId === this.auth.user?.id && (r.statut === 'EN_ATTENTE_MANAGER' || r.statut === 'EN_ATTENTE_RH');
  }
  canManagerAct(r: LeaveRequest): boolean { return this.role === 'MANAGER' && r.managerId === this.auth.user?.id && r.statut === 'EN_ATTENTE_MANAGER'; }
  canRhAct(r: LeaveRequest): boolean { return this.role === 'RH' && r.statut === 'EN_ATTENTE_RH'; }
  canRhCancel(r: LeaveRequest): boolean { return this.role === 'RH' && r.statut === 'APPROUVE' && r.dateDebut > this.today(); }
  attachmentRequired(type: string): boolean { return type === 'MALADIE' || type === 'MATERNITE'; }
  projectedBalanceAfter(): number { return Math.max(0, (this.currentBalance?.joursRestants || 26) - (this.draft.typeConge === 'ANNUEL' ? this.draftCalc.joursOuvres : 0)); }
  balanceAfter(r: LeaveRequest): number { const b = this.balances.get(r.employeeId) || (r.employeeId === this.auth.user?.id ? this.currentBalance : null); return Math.max(0, (b?.joursRestants || 26) - (r.statut.includes('ATTENTE') && r.typeConge === 'ANNUEL' ? r.nbJours : 0)); }
  employeeBalanceText(id: number): string { const b = this.balances.get(id); return b ? `${b.joursRestants}/${b.soldeAnnuel}` : '-'; }
  progressPct(b: BalanceRow): number { return b.soldeAnnuel ? Math.round((b.joursUtilises / b.soldeAnnuel) * 100) : 0; }
  filteredBalances(): BalanceRow[] { const q = this.balanceSearch.toLowerCase(); return this.balanceRows.filter((b) => !q || this.userName(b.employeeId).toLowerCase().includes(q) || this.userMatricule(b.employeeId).toLowerCase().includes(q)); }
  managerOptions(): UserRow[] {
    const ids = Array.from(new Set(this.rhRows.map((r) => r.managerId).filter((id): id is number => !!id)));
    return ids.map((id) => this.usersMap.get(id) || ({ id, prenom: 'Employé', nom: `#${id}`, role: 'MANAGER' as Role }));
  }
  loadMissingUsers(ids: number[]): void {
    const missing = Array.from(new Set(ids.filter((id) => id && !this.usersMap.has(id))));
    if (!missing.length) return;
    forkJoin(missing.map((id) =>
      this.http.get<UserRow>(`${environment.apiUrl}/api/users/${id}/summary`).pipe(catchError(() => of(null)))
    )).subscribe((users) => {
      users.forEach((u) => {
        if (u?.id) this.usersMap.set(u.id, u);
      });
    });
  }
  ref(r: LeaveRequest): string { return `CG-${new Date(r.createdAt || r.dateDebut).getFullYear()}-${String(r.id).padStart(4, '0')}`; }
  pageTitle(): string { return this.role === 'RH' ? 'Congés RH' : this.role === 'MANAGER' ? 'Congés équipe' : 'Mes congés'; }
  statusLabel(s: string): string { return this.statuses.find((x) => x.value === s)?.label || s; }
  statusClass(s: string): string { if (s === 'APPROUVE') return 'st-approved'; if (s === 'REFUSE') return 'st-refused'; if (s === 'ANNULE') return 'st-cancelled'; if (s === 'EN_ATTENTE_MANAGER') return 'st-pending-manager'; return 'st-pending-rh'; }
  typeLabel(t: string): string { return this.leaveTypes.find((x) => x.value === t)?.label || t; }
  showPeopleMeta(r: LeaveRequest): boolean { return this.role === 'RH' || (this.role === 'MANAGER' && r.employeeId !== this.auth.user?.id); }
  userName(id?: number | null): string {
    const u = id ? this.usersMap.get(id) : null;
    const self = id && this.auth.user?.id === id ? this.auth.user : null;
    return u ? `${u.prenom} ${u.nom}` : self ? `${self.prenom} ${self.nom}` : id ? `Employé #${id}` : '-';
  }
  actorName(id?: number): string { return id ? this.userName(id) : 'Système'; }
  userMatricule(id: number): string { return this.usersMap.get(id)?.matricule || ''; }
  userDept(id: number): string { return this.usersMap.get(id)?.departement || '-'; }
  userPoste(id: number): string { return this.usersMap.get(id)?.poste || this.usersMap.get(id)?.role || ''; }
  initials(id: number): string {
    const u = this.usersMap.get(id) || (this.auth.user?.id === id ? this.auth.user : null);
    const first = u?.prenom?.trim()?.[0] || 'E';
    const last = u?.nom?.trim()?.[0] || '';
    return (first + last).toUpperCase();
  }
  employeeSubline(id: number): string {
    const u = this.usersMap.get(id);
    const parts = [u?.poste, u?.matricule].filter(Boolean);
    return parts.join(' · ') || this.userMatricule(id);
  }
  managerLabel(userId: number): string { const managerId = this.usersMap.get(userId)?.managerId; return managerId ? this.userName(managerId) : ''; }
  formatPeriod(r: LeaveRequest): string { return `${this.shortDate(r.dateDebut)} -> ${this.shortDate(r.dateFin)}`; }
  shortDate(d: string): string { return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }); }
  fileUrl(path: string): string { return path.startsWith('http') ? path : `${environment.apiUrl}${path}`; }
  today(): string { return this.localDateIso(new Date()); }
  holidayKindLabel(k: string): string { return k === 'NATIONAL' ? 'National' : k === 'RELIGIOUS' ? 'Religieux' : 'Exceptionnel'; }
  detailTitle(r: LeaveRequest): string { return `${this.role === 'RH' ? 'Détail RH' : 'Détail'} — ${this.ref(r)}`; }
  historyLabel(action: string): string {
    const labels: Record<string, string> = {
      DEMANDE_SOUMISE: 'Demande soumise',
      VALIDATION_MANAGER: 'Validée par le manager',
      REFUS_MANAGER: 'Refusée par le manager',
      VALIDATION_RH: 'Validée définitivement',
      REFUS_RH: 'Refusée par RH',
      ANNULATION_DEMANDEUR: 'Annulée par le demandeur',
      ANNULATION_RH: 'Annulée par RH',
      JUSTIFICATIF_AJOUTE: 'Justificatif ajouté',
    };
    return labels[action] || action;
  }

  confirmTitle(): string {
    const titles: Record<ConfirmAction, string> = {
      EMP_CANCEL: 'Annuler la demande',
      MGR_APPROVE: 'Approuver la demande',
      MGR_REJECT: 'Refuser la demande',
      RH_APPROVE: 'Valider definitivement',
      RH_REJECT: 'Refuser la demande',
      RH_CANCEL: 'Annuler le congé',
    };
    return this.confirmAction ? titles[this.confirmAction] : '';
  }
}
