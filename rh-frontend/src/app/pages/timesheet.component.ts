import { NgClass, NgFor, NgIf } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../core/auth.service';
import { environment } from '../../environments/environment';
import { IIconComponent } from '../core/i-icon.component';

type Role = 'RH' | 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
type Status = 'BROUILLON' | 'SOUMIS' | 'VALIDE' | 'REJETE';
type WorkMode = 'PRESENTIEL' | 'TELETRAVAIL' | 'HYBRIDE';

interface Project {
  id: number;
  nom: string;
}

interface DayInfo {
  date: string;
  workingDay: boolean;
  holidayName?: string;
  leaveType?: string;
}

interface Entry {
  id: number;
  dateJour: string;
  nbHeures: number;
  description?: string;
  entryType: string;
  workMode?: WorkMode;
  projectId?: number;
  projectName?: string;
}

interface Deliverable {
  id?: number;
  label: string;
  url: string;
}

interface Timesheet {
  id: number;
  employeeId: number;
  employeeName?: string;
  employeeMatricule?: string;
  employeeDepartment?: string;
  managerId?: number;
  managerName?: string;
  semaineDebut: string;
  statut: Status;
  commentaireManager?: string;
  totalHeures: number;
  expectedHours: number;
  holidayDays: number;
  leaveDays: number;
  refusedLeaveDays?: number;
  faitsMarquants?: string;
  risquesBlocages?: string;
  planSemaineProchaine?: string;
  suggestionsAmeliorations?: string;
  entries: Entry[];
  deliverables: Deliverable[];
  events: { action: string; actorId?: number; comment?: string; createdAt: string }[];
  days: DayInfo[];
}

@Component({
  standalone: true,
  selector: 'app-timesheet',
  imports: [NgIf, NgFor, NgClass, FormsModule, IIconComponent],
  template: `
    <section class="ts-page" [class.rh-view]="role === 'RH'">
      <div class="service-alert" *ngIf="serviceUnavailable">
        Le service feuille de temps est temporairement indisponible.
      </div>

      <div class="toast" *ngIf="toastMessage" [ngClass]="toastType">
        {{ toastMessage }}
      </div>

      <div class="app-modal" *ngIf="rejectTarget">
        <div class="modal-card">
          <header class="modal-head">
            <h2>Refuser la feuille</h2>
            <button class="close-btn" (click)="cancelReject()">×</button>
          </header>
          <div class="modal-body">
            <label>Commentaire (obligatoire)
              <textarea [(ngModel)]="rejectComment" placeholder="Expliquez la raison du refus..."></textarea>
            </label>
          </div>
          <div class="form-actions">
            <button class="modal-cancel-btn" (click)="cancelReject()">Annuler</button>
            <button class="modal-danger-btn" (click)="confirmReject()">Confirmer le refus</button>
          </div>
        </div>
      </div>

      <ng-container *ngIf="!serviceUnavailable">
        <ng-container *ngIf="role === 'RH'; else employeeManagerView">
          <ng-container *ngIf="viewMode === 'list'; else detailView">
            <div class="stats-grid rh-stats">
              <article class="metric"><span>En attente RH</span><strong>{{ rhPending }}</strong><div class="metric-icon clock-icon"><i-icon name="clock" size="20"></i-icon></div></article>
              <article class="metric"><span>Validées</span><strong class="green">{{ countBy('VALIDE') }}</strong><div class="metric-icon check-icon"><i-icon name="check-circle" size="20"></i-icon></div></article>
              <article class="metric"><span>Refusées</span><strong class="red">{{ countBy('REJETE') }}</strong><div class="metric-icon x-icon"><i-icon name="x-circle" size="20"></i-icon></div></article>
              <article class="metric"><span>Non soumises</span><strong class="orange">0</strong><div class="metric-icon warn-icon"><i-icon name="alert-triangle" size="20"></i-icon></div></article>
              <article class="metric"><span>Taux soumission</span><strong class="blue">{{ submissionRate }} %</strong><div class="metric-icon percent-icon"><i-icon name="percent" size="20"></i-icon></div></article>
            </div>

            <section class="panel table-panel">
              <div class="panel-toolbar rh-toolbar">
                <h2>Feuilles à valider </h2>
                <div class="rh-filters">
                  <div class="rh-filters-row1">
                    <select [(ngModel)]="vDept"><option value="">Tous départements</option><option *ngFor="let d of departments" [value]="d">{{ d }}</option></select>
                    <select [(ngModel)]="vStatus"><option value="">Tous statuts</option><option value="SOUMIS">Soumise</option><option value="VALIDE">Validée</option><option value="REJETE">Refusée</option></select>
                  </div>
                </div>
              </div>
              <table class="data-table">
                <thead><tr><th>Employé</th><th>Département</th><th>Manager</th><th>Semaine</th><th>Saisies</th><th>Attendues</th><th>Statut</th><th>Action</th></tr></thead>
                <tbody>
                  <tr *ngFor="let sheet of rhValidationSheets">
                    <td class="td-employee"><div class="person"><span>{{ initials(sheet.employeeName) }}</span><div><b>{{ displayEmployee(sheet) }}</b><small>{{ sheet.employeeMatricule || '-' }}</small></div></div></td>
                    <td>{{ sheet.employeeDepartment || '-' }}</td>
                    <td>{{ sheet.managerName || '—' }}</td>
                    <td>{{ weekRange(sheet.semaineDebut) }}</td>
                    <td>{{ fmt(sheet.totalHeures) }} h</td>
                    <td>{{ sheet.expectedHours }} h</td>
                    <td><span class="badge" [ngClass]="statusClass(sheet.statut)">{{ statusLabel(sheet.statut) }}</span></td>
                    <td><button class="voir-btn" (click)="openDetail(sheet)"><i-icon name="eye" size="14"></i-icon> Voir</button></td>
                  </tr>
                  <tr *ngIf="rhValidationSheets.length === 0"><td colspan="8" class="empty">Aucune feuille à valider.</td></tr>
                </tbody>
              </table>
            </section>

            <section class="panel table-panel">
              <div class="panel-toolbar rh-toolbar">
                <h2>Feuilles en consultation</h2>
                <div class="rh-filters">
                  <div class="rh-filters-row1">
                    <select [(ngModel)]="rMgr"><option value="">Tous managers</option><option value="NONE">Aucun manager</option><option *ngFor="let m of managers" [value]="m">{{ m }}</option></select>
                    <select [(ngModel)]="rStatus"><option value="">Tous statuts</option><option value="SOUMIS">Soumise</option><option value="VALIDE">Validée</option><option value="REJETE">Refusée</option></select>
                  </div>
                </div>
              </div>
              <table class="data-table">
                <thead><tr><th>Employé</th><th>Département</th><th>Manager</th><th>Semaine</th><th>Saisies</th><th>Attendues</th><th>Statut</th><th>Action</th></tr></thead>
                <tbody>
                  <tr *ngFor="let sheet of rhReadOnlySheets">
                    <td class="td-employee"><div class="person"><span>{{ initials(sheet.employeeName) }}</span><div><b>{{ displayEmployee(sheet) }}</b><small>{{ sheet.employeeMatricule || '-' }}</small></div></div></td>
                    <td>{{ sheet.employeeDepartment || '-' }}</td>
                    <td>{{ sheet.managerName || '—' }}</td>
                    <td>{{ weekRange(sheet.semaineDebut) }}</td>
                    <td>{{ fmt(sheet.totalHeures) }} h</td>
                    <td>{{ sheet.expectedHours }} h</td>
                    <td><span class="badge" [ngClass]="statusClass(sheet.statut)">{{ statusLabel(sheet.statut) }}</span></td>
                    <td><button class="voir-btn" (click)="openDetail(sheet)"><i-icon name="eye" size="14"></i-icon> Voir</button></td>
                  </tr>
                  <tr *ngIf="rhReadOnlySheets.length === 0"><td colspan="8" class="empty">Aucune feuille en consultation.</td></tr>
                </tbody>
              </table>
            </section>
          </ng-container>
        </ng-container>

        <ng-template #employeeManagerView>
          <ng-container *ngIf="viewMode === 'list'; else detailView">
            <div class="stats-grid" [class.manager-stats]="role === 'MANAGER'">
              <article class="metric"><span>{{ role === 'MANAGER' ? 'Ma semaine' : 'Heures saisies' }}</span><strong class="blue">{{ personalHours }}/{{ current?.expectedHours || 0 }} h</strong><div class="metric-icon clock-icon"><i-icon name="clock" size="20"></i-icon></div></article>
              <article class="metric" *ngIf="role === 'MANAGER'"><span>Équipe à valider</span><strong class="orange">{{ teamPending }}</strong><div class="metric-icon warn-icon"><i-icon name="bell" size="20"></i-icon></div></article>
              <article class="metric" *ngIf="role === 'EMPLOYEE'"><span>Jours fériés</span><strong class="green">{{ current?.holidayDays || 0 }}</strong><div class="metric-icon calendar-icon"><i-icon name="calendar" size="20"></i-icon></div></article>
              <article class="metric" *ngIf="role === 'EMPLOYEE'"><span>Feuilles validées</span><strong class="green">{{ countMySheetsByStatus('VALIDE') }}</strong><div class="metric-icon check-icon"><i-icon name="check-circle" size="20"></i-icon></div></article>
              <article class="metric" *ngIf="role === 'EMPLOYEE'"><span>Feuilles refusées</span><strong class="red">{{ countMySheetsByStatus('REJETE') }}</strong><div class="metric-icon x-icon"><i-icon name="x-circle" size="20"></i-icon></div></article>
              <article class="metric" *ngIf="role === 'MANAGER'"><span>Validées (mois)</span><strong class="green">{{ countTeamBy('VALIDE') }}</strong><div class="metric-icon check-icon"><i-icon name="check-circle" size="20"></i-icon></div></article>
              <article class="metric" *ngIf="role === 'MANAGER'"><span>Refusées (mois)</span><strong class="red">{{ countTeamBy('REJETE') }}</strong><div class="metric-icon x-icon"><i-icon name="x-circle" size="20"></i-icon></div></article>
            </div>

            <section class="panel week-panel" *ngIf="current">
              <div class="week-top">
                <div class="week-title">
                  <button class="icon-btn" (click)="shiftWeek(-7)">‹</button>
                  <div><small>Semaine</small><strong>{{ weekCode(current.semaineDebut) }} — {{ weekRange(current.semaineDebut) }}</strong></div>
                  <button class="icon-btn" [disabled]="!canGoNextWeek()" (click)="shiftWeek(7)">›</button>
                  <span class="badge" [ngClass]="statusClass(current.statut)">{{ statusLabel(current.statut) }}</span>
                </div>
                <div class="week-actions" *ngIf="current.statut === 'BROUILLON'">
                  <button class="save-draft-btn" (click)="saveDraftOnly()">Brouillon</button>
                  <button class="submit-sheet-btn" (click)="submitCurrent()">Soumettre</button>
                </div>
                <div class="week-actions" *ngIf="current.statut === 'REJETE'">
                  <button class="reopen-btn" (click)="reopenCurrent()">Reprendre en brouillon</button>
                </div>
              </div>

              <div class="days-title"><b></b><span>Max 7h / jour · {{ current.expectedHours }}h attendues</span></div>
              <div class="week-grid">
                <article class="day-card" *ngFor="let day of current.days">
                  <header><div><span>{{ dayName(day.date) }}</span><b>{{ dayShort(day.date) }}</b></div></header>
                  <div class="day-body">
                    <ng-container *ngIf="day.holidayName; else leaveOrWork">
                      <span class="pill green">Jour férié</span>
                      <p>{{ day.holidayName }}</p>
                    </ng-container>
                    <ng-template #leaveOrWork>
                      <ng-container *ngIf="day.leaveType; else workDay">
                        <span class="pill blue">Congé validé</span>
                        <p>{{ leaveLabel(day.leaveType) }}</p>
                      </ng-container>
                    </ng-template>
                    <ng-template #workDay>
                      <p>Projet · <b>{{ projectName(entryFor(day.date)) || defaultProjectLabel() }}</b></p>
                      <p class="hours"><i-icon name="clock" size="13"></i-icon> {{ entryFor(day.date)?.nbHeures || 0 }} h</p>
                      <p class="mode" [ngClass]="(entryFor(day.date)?.workMode || '').toLowerCase()">
                        <i-icon *ngIf="entryFor(day.date)?.workMode === 'TELETRAVAIL'" name="home" size="14"></i-icon>
                        <i-icon *ngIf="entryFor(day.date)?.workMode === 'HYBRIDE'" name="layers" size="14"></i-icon>
                        <i-icon *ngIf="entryFor(day.date)?.workMode === 'PRESENTIEL'" name="briefcase" size="14"></i-icon>
                        {{ workModeLabel(entryFor(day.date)?.workMode) }}
                      </p>
                    </ng-template>
                  </div>
                  <footer *ngIf="current.statut === 'BROUILLON' && day.workingDay">
                    <button class="modifier-btn" (click)="openEdit(day)"><i-icon name="edit-2" size="14"></i-icon> Modifier</button>
                  </footer>
                </article>
              </div>

              <h2 class="section-title">Rapport hebdomadaire</h2>
              <div class="report-grid">
                <label class="report-card required"><span>Faits marquants <em>Requis</em></span><textarea [readonly]="current.statut !== 'BROUILLON'" [(ngModel)]="report.faitsMarquants" (change)="saveDraftOnly()" placeholder="Livraisons, objectifs atteints, réunions clés..."></textarea></label>
                <label class="report-card required"><span>Risques & blocages <em>Requis</em></span><textarea [readonly]="current.statut !== 'BROUILLON'" [(ngModel)]="report.risquesBlocages" (change)="saveDraftOnly()" placeholder="Retards, dépendances bloquantes, alertes..."></textarea></label>
                <label class="report-card required"><span>Plan semaine prochaine <em>Requis</em></span><textarea [readonly]="current.statut !== 'BROUILLON'" [(ngModel)]="report.planSemaineProchaine" (change)="saveDraftOnly()" placeholder="Priorités, jalons, objectifs..."></textarea></label>
                <label class="report-card wide"><span>Suggestions & améliorations</span><textarea [readonly]="current.statut !== 'BROUILLON'" [(ngModel)]="report.suggestionsAmeliorations" (change)="saveDraftOnly()" placeholder="Saisir suggestions & améliorations..."></textarea></label>
                <div class="report-card deliverables">
                  <span>Livrables <button class="link-btn" *ngIf="current.statut === 'BROUILLON'" (click)="addDeliverable()">+ Ajouter un lien</button></span>
                  <div class="deliverable-row-url" *ngFor="let d of deliverables; let i = index">
                    <input [readonly]="current.statut !== 'BROUILLON'" [(ngModel)]="d.url" (change)="saveDraftOnly()" placeholder="https://drive.google.com/..." />
                    <button class="icon-btn" *ngIf="current.statut === 'BROUILLON'" (click)="removeDeliverable(i)">×</button>
                  </div>
                  <p *ngIf="deliverables.length === 0">Aucun livrable ajouté.</p>
                </div>
              </div>
            </section>

            <section class="panel history-panel">
              <div class="panel-toolbar"><h2>{{ role === 'MANAGER' ? 'Mes feuilles personnelles' : 'Historique' }}</h2></div>
              <table class="data-table compact">
                <thead><tr><th>Semaine</th><th>Période</th><th>Statut</th><th>Heures saisies</th><th>Heures attendues</th><th>Action</th></tr></thead>
                <tbody>
                  <tr *ngFor="let sheet of myHistory"><td>{{ weekCode(sheet.semaineDebut) }}</td><td>{{ weekRange(sheet.semaineDebut) }}</td><td><span class="badge" [ngClass]="statusClass(sheet.statut)">{{ statusLabel(sheet.statut) }}</span></td><td>{{ fmt(sheet.totalHeures) }} h</td><td>{{ sheet.expectedHours }} h</td><td><button class="voir-btn" (click)="openDetail(sheet)"><i-icon name="eye" size="14"></i-icon> Voir</button></td></tr>
                  <tr *ngIf="myHistory.length === 0"><td colspan="6" class="empty" style="color:#2563eb;">Aucune feuille trouvée.</td></tr>
                </tbody>
              </table>
            </section>

            <section class="panel table-panel" *ngIf="role === 'MANAGER'">
              <div class="panel-toolbar">
                <h2>Feuilles de mon équipe</h2>
                <div class="filters">
                  <label class="search"><i-icon name="search" size="16" color="#94a3b8"></i-icon><input [(ngModel)]="search" placeholder="Rechercher un collaborateur" /></label>
                  <select [(ngModel)]="statusFilter"><option value="">Tous statuts</option><option value="SOUMIS">Soumise</option><option value="VALIDE">Validée</option><option value="REJETE">Refusée</option></select>
                  <button class="primary-btn sm-btn" (click)="remindTeam()"><i-icon name="refresh-cw" size="14"></i-icon> Relancer les non soumis</button>
                </div>
              </div>
              <table class="data-table">
                <thead><tr><th>Collaborateur</th><th>Semaine</th><th>Saisies</th><th>Attendues</th><th>Statut</th><th>Actions</th></tr></thead>
                <tbody>
                  <tr *ngFor="let sheet of filteredTeamSheets"><td>{{ displayEmployee(sheet) }}</td><td>{{ weekRange(sheet.semaineDebut) }}</td><td>{{ fmt(sheet.totalHeures) }} h</td><td>{{ sheet.expectedHours }} h</td><td><span class="badge" [ngClass]="statusClass(sheet.statut)">{{ statusLabel(sheet.statut) }}</span></td><td><button class="voir-btn" (click)="openDetail(sheet)"><i-icon name="eye" size="14"></i-icon> Voir</button></td></tr>
                  <tr *ngIf="filteredTeamSheets.length === 0"><td colspan="6" class="empty">Aucune feuille soumise.</td></tr>
                </tbody>
              </table>
            </section>
          </ng-container>
        </ng-template>

        <ng-template #detailView>
          <section class="panel detail-panel" *ngIf="selectedSheet">
            <button class="close-btn" (click)="closePanel()">×</button>
            <div class="detail-heading"><small>Référence FT-{{ weekCode(selectedSheet.semaineDebut) }}</small><h2>Détail feuille — {{ displayEmployee(selectedSheet) }}</h2></div>
            <div class="detail-metrics">
              <article><span>Semaine</span><strong>{{ weekCode(selectedSheet.semaineDebut) }} — {{ weekRange(selectedSheet.semaineDebut) }}</strong></article>
              <article><span>Heures saisies / attendues</span><strong class="blue">{{ fmt(selectedSheet.totalHeures) }}/{{ selectedSheet.expectedHours }} h</strong></article>
              <article><span>Jours fériés</span><strong class="green">{{ selectedSheet.holidayDays }}</strong></article>
              <article><span>Congés</span><strong class="orange">{{ selectedSheet.leaveDays }}</strong></article>
            </div>
            <span class="badge" [ngClass]="statusClass(selectedSheet.statut)">{{ statusLabel(selectedSheet.statut) }}</span>
            <h3>Grille semaine</h3>
            <div class="week-grid readonly">
              <article class="day-card" *ngFor="let day of selectedSheet.days">
                <header><div><span>{{ dayName(day.date) }}</span><b>{{ dayShort(day.date) }}</b></div></header>
                <div class="day-body">
                  <p *ngIf="day.holidayName" class="pill green">Jour férié</p>
                  <p *ngIf="day.leaveType" class="pill blue">Congé validé</p>
                  <ng-container *ngIf="!day.holidayName && !day.leaveType">
                    <p>Projet · <b>{{ projectName(entryFor(day.date, selectedSheet)) || '—' }}</b></p>
                    <p class="hours">◴ {{ entryFor(day.date, selectedSheet)?.nbHeures || 0 }} h</p>
                    <p class="mode" [ngClass]="(entryFor(day.date, selectedSheet)?.workMode || '').toLowerCase()">
                      <i-icon *ngIf="entryFor(day.date, selectedSheet)?.workMode === 'TELETRAVAIL'" name="home" size="14"></i-icon>
                      <i-icon *ngIf="entryFor(day.date, selectedSheet)?.workMode === 'HYBRIDE'" name="layers" size="14"></i-icon>
                      <i-icon *ngIf="entryFor(day.date, selectedSheet)?.workMode === 'PRESENTIEL'" name="briefcase" size="14"></i-icon>
                      {{ workModeLabel(entryFor(day.date, selectedSheet)?.workMode) }}
                    </p>
                    <p class="task-text" *ngIf="entryFor(day.date, selectedSheet)?.description">{{ entryFor(day.date, selectedSheet)?.description }}</p>
                  </ng-container>
                </div>
              </article>
            </div>
            <div class="report-grid detail-report">
              <article><h4>Faits marquants</h4><p>{{ selectedSheet.faitsMarquants || '—' }}</p></article>
              <article><h4>Risques & blocages</h4><p>{{ selectedSheet.risquesBlocages || '—' }}</p></article>
              <article><h4>Plan semaine prochaine</h4><p>{{ selectedSheet.planSemaineProchaine || '—' }}</p></article>
              <article class="wide" *ngIf="selectedSheet.suggestionsAmeliorations"><h4>Suggestions & améliorations</h4><p>{{ selectedSheet.suggestionsAmeliorations }}</p></article>
            </div>
            <div class="detail-deliverables" *ngIf="selectedSheet.deliverables?.length">
              <h3>Livrables</h3>
              <ul class="deliverable-list">
                <li *ngFor="let d of selectedSheet.deliverables">
                  <a [href]="d.url" target="_blank" rel="noopener"><i-icon name="external-link" size="14"></i-icon> <span>{{ d.url }}</span></a>
                </li>
              </ul>
            </div>
            <h3>Timeline</h3>
            <div class="timeline">
              <div *ngFor="let event of selectedSheet.events" [ngClass]="getEventClass(event.action)"><span></span><b>{{ formatEventAction(event.action) }}</b><small>{{ shortDate(event.createdAt) }}</small><p *ngIf="event.comment">« {{ event.comment }} »</p></div>
              <div *ngIf="selectedSheet.events.length === 0"><span></span><b>Brouillon créé</b></div>
            </div>
            <div class="detail-actions" *ngIf="canValidate(selectedSheet)">
              <button class="success-btn" (click)="approveSheet(selectedSheet)">Valider</button>
              <button class="danger-btn" (click)="rejectSheet(selectedSheet)">Refuser</button>
            </div>
            <div class="detail-actions" *ngIf="canReopen(selectedSheet)">
              <button class="reopen-btn" (click)="reopenSheet(selectedSheet)">Reprendre en brouillon</button>
            </div>
          </section>
        </ng-template>

        <div class="edit-panel-backdrop" *ngIf="viewMode === 'edit' && editDay">
          <section class="edit-panel">
            <header class="edit-panel-head">
              <div class="edit-panel-title">
                <span class="edit-panel-day-label">{{ dayName(editDay.date) }}</span>
                <h2>{{ dayShort(editDay.date) }}</h2>
              </div>
              <button class="close-modal-btn" (click)="closePanel()">&times;</button>
            </header>
            <div class="edit-panel-body">
              <div class="panel-toast" *ngIf="toastMessage" [ngClass]="toastType">
                {{ toastMessage }}
              </div>
              <div class="edit-grid">
                <label>Projet
                  <select [(ngModel)]="editForm.projectId">
                    <option [ngValue]="null">Choisir un projet</option>
                    <option *ngFor="let p of projects" [ngValue]="p.id">{{ p.nom }}</option>
                  </select>
                </label>
                <label>Nombre d'heures (max 7)
                  <input type="number" min="1" max="7" [(ngModel)]="editForm.nbHeures" />
                </label>
                <label class="full">Mode de travail
                  <div class="modes-btn-group">
                    <button [class.active]="editForm.workMode === 'PRESENTIEL'" (click)="editForm.workMode = 'PRESENTIEL'"><i-icon name="briefcase" size="14"></i-icon> Présentiel</button>
                    <button [class.active]="editForm.workMode === 'TELETRAVAIL'" (click)="editForm.workMode = 'TELETRAVAIL'"><i-icon name="home" size="14"></i-icon> Télétravail</button>
                    <button [class.active]="editForm.workMode === 'HYBRIDE'" (click)="editForm.workMode = 'HYBRIDE'"><i-icon name="layers" size="14"></i-icon> Hybride</button>
                  </div>
                </label>
                <label class="full">Description des tâches
                  <textarea [(ngModel)]="editForm.description" placeholder="Décrivez les tâches réalisées"></textarea>
                </label>
              </div>
            </div>
            <footer class="edit-actions">
              <button class="ghost-btn" (click)="closePanel()">Annuler</button>
              <button class="primary-btn" (click)="saveDay()">Enregistrer</button>
            </footer>
          </section>
        </div>
      </ng-container>
    </section>
  `,
  styles: [`
    :host { display:block; --blue:#2563eb; --ink:#071831; --muted:#58708e; --line:#d9e3f0; --soft:#f4f8fc; --panel:#fff; font-family: Inter, "Segoe UI", Arial, sans-serif; color:var(--ink); }
    * { box-sizing:border-box; }
    .ts-page { min-height:100%; padding:0; background:#eef4fa; overflow-x:hidden; }
    .page-head { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:18px; }
    h1 { margin:0 0 4px; font-size:22px; line-height:1.1; font-weight:650; letter-spacing:0; }
    .page-head p { margin:0; color:#526a86; font-size:13px; }
    h2 { margin:0; font-size:16px; font-weight:650; color:#0f172a; }
    h3 { margin:16px 0 10px; font-size:14px; font-weight:600; }
    button, input, select, textarea { font:inherit; }
    .service-alert { padding:14px; border:1px solid #fed7aa; background:#fff7ed; color:#9a3412; border-radius:8px; }
    .toast { position:fixed; top:24px; right:80px; z-index:50; max-width:420px; padding:12px 14px; border-radius:8px; border:1px solid #bfdbfe; background:#eff6ff; color:#0f3d87; box-shadow:0 14px 30px rgba(15,23,42,.12); font-size:13px; font-weight:560; }
    .toast.success { border-color:#bbf7d0; background:#f0fdf4; color:#047857; }
    .toast.error { border-color:#fecdd3; background:#fff1f2; color:#be123c; }
    .app-modal { position:fixed; inset:0; z-index:200; background:rgba(15,23,42,.4); display:grid; place-items:center; padding:20px; backdrop-filter:blur(3px); -webkit-backdrop-filter:blur(3px); }
    .modal-card { background:#fff; width:100%; max-width:460px; border-radius:10px; box-shadow:0 12px 36px rgba(15,23,42,.15); display:flex; flex-direction:column; overflow:hidden; }
    .modal-head { padding:20px 24px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; }
    .modal-head h2 { margin:0; font-size:16px; font-weight:650; color:#0f172a; }
    .modal-head .close-btn { width:28px; height:28px; border:none; background:transparent; color:#64748b; font-size:20px; cursor:pointer; display:grid; place-items:center; border-radius:6px; transition:background .2s; }
    .modal-head .close-btn:hover { background:#f1f5f9; color:#0f172a; }
    .modal-body { padding:24px; }
    .modal-body label { display:flex; flex-direction:column; gap:8px; font-size:13px; font-weight:500; color:#475569; }
    .modal-body textarea { width:100%; min-height:110px; padding:12px; border:1px solid #cbd5e1; border-radius:8px; font-size:14px; outline:none; resize:vertical; font-family:'Inter',sans-serif; }
    .modal-body textarea:focus { border-color:#2563eb; }
    .form-actions { padding:14px 20px; display:flex; justify-content:flex-end; gap:8px; background:#f8fafc; border-top:1px solid #e2e8f0; }
    .modal-cancel-btn { height:32px; padding:0 14px; border:1px solid #d1d5db; border-radius:7px; background:#fff; color:#374151; font-size:13px; font-weight:500; cursor:pointer; transition:background .15s; }
    .modal-cancel-btn:hover { background:#f9fafb; }
    .modal-danger-btn { height:32px; padding:0 14px; border:none; border-radius:7px; background:#dc2626; color:#fff; font-size:13px; font-weight:600; cursor:pointer; transition:background .15s; }
    .modal-danger-btn:hover { background:#b91c1c; }
    .edit-panel-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.25); z-index:100; display:flex; justify-content:flex-end; padding:0; backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px); }
    .edit-panel { background:#fff; width:100%; max-width:540px; height:100vh; border-radius:0; box-shadow:-16px 0 48px rgba(15,23,42,.18); position:relative; overflow:hidden; display:flex; flex-direction:column; border-left:1px solid rgba(226,232,240,.8); }
    .edit-panel-head { background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding:24px; display:flex; justify-content:space-between; align-items:flex-start; }
    .edit-panel-title { display:flex; flex-direction:column; gap:4px; }
    .edit-panel-day-label { font-size:12px; font-weight:500; color:#94a3b8; text-transform:uppercase; letter-spacing:.08em; }
    .edit-panel-head h2 { font-size:20px; font-weight:700; color:#fff; margin:0; }
    .edit-panel-head button.close-modal-btn { width:32px; height:32px; border:1px solid rgba(255,255,255,.15); border-radius:8px; background:rgba(255,255,255,.08); color:#94a3b8; cursor:pointer; display:grid; place-items:center; font-size:18px; line-height:1; transition:all .2s; flex-shrink:0; }
    .edit-panel-head button.close-modal-btn:hover { background:rgba(255,255,255,.15); color:#fff; }
    .edit-panel-body { padding:24px; flex:1; overflow-y:auto; background:#f8fafc; }
    .edit-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
    .edit-grid label { display:flex; flex-direction:column; gap:8px; font-size:13px; font-weight:500; color:#475569; }
    .edit-grid label.full { grid-column:1 / -1; }
    .edit-grid input, .edit-grid select, .edit-grid textarea { border:1px solid #d9e3f0; border-radius:8px; background:#fff; padding:10px 12px; font-size:14px; outline:none; transition:border-color .2s; font-family:'Inter',sans-serif; }
    .edit-grid input:focus, .edit-grid select:focus, .edit-grid textarea:focus { border-color:#2563eb; }
    .edit-grid select { height:40px; cursor:pointer; }
    .edit-grid input { height:40px; }
    .modes-btn-group { display:flex; gap:8px; }
    .modes-btn-group button { flex:1; height:36px; background:#fff; border:1px solid #d9e3f0; border-radius:8px; color:#64748b; font-size:13px; font-weight:500; cursor:pointer; transition:all .2s; display:flex; align-items:center; justify-content:center; gap:6px; font-family:'Inter',sans-serif; }
    .modes-btn-group button.active { border-color:#2563eb; background:#eff6ff; color:#2563eb; }
    .edit-actions { padding:14px 20px; border-top:1px solid #e2e8f0; display:flex; justify-content:flex-end; gap:8px; background:#fff; }
    .edit-actions .ghost-btn { border:1px solid #d1d5db; background:#fff; color:#374151; border-radius:7px; height:32px; padding:0 14px; font-size:13px; font-weight:500; cursor:pointer; transition:background .15s; }
    .edit-actions .ghost-btn:hover { background:#f9fafb; }
    .edit-actions .primary-btn { background:#2563eb; color:#fff; border:none; border-radius:7px; height:32px; padding:0 16px; font-size:13px; font-weight:600; cursor:pointer; transition:background .15s; }
    .edit-actions .primary-btn:hover { background:#1d4ed8; }
    .panel-toast { margin-bottom:16px; padding:10px 14px; border-radius:8px; font-size:13px; font-weight:500; border:1px solid #bfdbfe; background:#eff6ff; color:#0f3d87; }
    .panel-toast.success { border-color:#bbf7d0; background:#f0fdf4; color:#047857; }
    .panel-toast.error { border-color:#fecdd3; background:#fff1f2; color:#be123c; }
    .stats-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:18px; }
    .rh-stats { grid-template-columns:repeat(5,minmax(0,1fr)); }
    .metric { position:relative; min-height:86px; padding:20px; background:#fff; border:1px solid var(--line); border-radius:12px; }
    .metric span { display:block; color:#64748b; text-transform:uppercase; font-size:11px; font-weight:600; letter-spacing:.02em; margin-bottom:8px; position:relative; z-index:2; padding-right:36px; }
    .metric strong { display:block; font-size:26px; font-weight:700; color:#0f172a; }
    .metric .metric-icon { position:absolute; top:20px; right:20px; width:42px; height:42px; border-radius:10px; display:grid; place-items:center; }
    .clock-icon { background:#eff6ff; color:#3b82f6; }
    .check-icon { background:#ecfdf5; color:#10b981; }
    .x-icon { background:#fef2f2; color:#ef4444; }
    .warn-icon { background:#fffbeb; color:#f59e0b; }
    .percent-icon { background:#eff6ff; color:#3b82f6; }
    .calendar-icon { background:#f5f3ff; color:#8b5cf6; }
    .user-icon { background:#ecfdf5; color:#10b981; }
    .blue { color:#3b82f6; } .green { color:#10b981; } .orange { color:#f59e0b; } .red { color:#ef4444; }
    .panel { background:#fff; border:1px solid var(--line); border-radius:12px; margin-bottom:20px; overflow:hidden; }
    .week-panel, .detail-panel { padding:20px; }
    .panel-toolbar { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:18px 20px; border-bottom:1px solid var(--line); }
    .rh-toolbar { align-items:flex-start; }
    .rh-filters { display:flex; flex-direction:column; gap:8px; }
    .rh-filters-row1 { display:flex; gap:8px; align-items:center; }
    .rh-filters-row2 { display:flex; justify-content:flex-end; gap:8px; }
    .filters { display:flex; gap:8px; align-items:center; flex-wrap:wrap; justify-content:flex-end; }
    .sm-btn { display:inline-flex; align-items:center; gap:6px; height:38px; padding:0 16px; border-radius:8px; background:#2563eb; color:#fff; font-size:13px; font-weight:600; border:none; cursor:pointer; transition:all .2s; }
    .sm-btn:hover { background:#1d4ed8; }
    .week-actions { display:flex; gap:12px; align-items:center; }
    .save-draft-btn { display:inline-flex; align-items:center; gap:8px; height:38px; padding:0 16px; border:1px solid #cbd5e1; border-radius:8px; background:#fff; color:#475569; font-size:14px; font-weight:600; cursor:pointer; transition:all .2s; }
    .save-draft-btn:hover { background:#f8fafc; border-color:#94a3b8; color:#0f172a; }
    .submit-sheet-btn { display:inline-flex; align-items:center; gap:8px; height:38px; padding:0 20px; border:none; border-radius:8px; background:#2563eb; color:#fff; font-size:14px; font-weight:600; cursor:pointer; transition:all .2s; box-shadow:0 2px 4px rgba(37,99,235,.15); }
    .submit-sheet-btn:hover { background:#1d4ed8; box-shadow:0 4px 8px rgba(37,99,235,.25); transform:translateY(-1px); }
    .reopen-btn { display:inline-flex; align-items:center; height:32px; padding:0 14px; border:1px solid #2563eb; border-radius:7px; background:#fff; color:#2563eb; font-size:13px; font-weight:600; cursor:pointer; transition:all .15s; }
    .reopen-btn:hover { background:#eff6ff; }
    .rh-filters select { width:auto; max-width:170px; font-size:13px; }
    .search { display:flex; align-items:center; gap:8px; height:38px; width:260px; border:1px solid #e2e8f0; border-radius:8px; padding:0 12px; background:#fff; color:#94a3b8; flex-shrink:0; }
    .search i-icon { display:flex; align-items:center; justify-content:center; }
    .search input { border:0; outline:0; width:100%; background:transparent; color:#0f172a; font-family:'Inter',sans-serif; font-size:13px; }
    select { border:1px solid #e2e8f0; border-radius:8px; background:#fff; color:#0f172a; outline:none; font-family:'Inter',sans-serif; height:38px; padding:0 32px 0 12px; appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%2394a3b8' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 10px center; cursor:pointer; font-size:13px; }
    input, textarea { border:1px solid #e2e8f0; border-radius:8px; background:#fff; color:#0f172a; outline:none; font-family:'Inter',sans-serif; }
    input { height:38px; padding:0 12px; }
    textarea { min-height:56px; resize:vertical; padding:12px; font-size:13px; }
    .data-table { width:100%; border-collapse:collapse; table-layout:fixed; background:#fff; }
    th { height:44px; background:#f8fafc; color:#475569; font-size:13px; font-weight:600; text-align:center; border-bottom:1px solid #e2e8f0; padding:0 12px; }
    td { height:60px; border-bottom:1px solid #f1f5f9; padding:10px 12px; text-align:center; font-size:14px; font-weight:400; vertical-align:middle; color:#334155; }
    td.empty { text-align:center !important; padding:40px !important; font-style:italic; color:#64748b; font-size:14px; }
    .td-employee .person { justify-content:center; text-align:left; }
    .compact td { height:44px; }
    .person { display:flex; align-items:center; gap:10px; text-align:left; justify-content:flex-start; }
    .person span { flex:0 0 36px; height:36px; border-radius:50%; display:grid; place-items:center; background:#dbeafe; color:#155cff; font-size:12px; font-weight:650; }
    .person b { display:block; font-size:13px; font-weight:620; line-height:1.25; }
    .person small { display:block; color:#516a87; font-size:11px; margin-top:2px; }
    .badge { display:inline-flex; align-items:center; gap:6px; width:max-content; max-width:100%; height:24px; padding:0 10px; border-radius:999px; font-size:12px; font-weight:560; white-space:nowrap; }
    .badge::before { content:""; width:6px; height:6px; border-radius:50%; background:currentColor; }
    .st-draft { background:#eef2f7; color:#64748b; } .st-submitted { background:#dff1ff; color:#006fba; } .st-valid { background:#d9fae6; color:#00875a; } .st-reject { background:#ffe2e7; color:#d0143d; }
    .link-btn, .ghost-btn, .primary-btn, .orange-btn, .success-btn, .danger-btn, .danger-solid-btn, .icon-btn { border:1px solid var(--line); background:#fff; border-radius:7px; height:36px; padding:0 12px; cursor:pointer; color:#0f5fff; font-weight:560; }
    .modifier-btn { display:flex; align-items:center; justify-content:center; gap:6px; width:100%; height:36px; color:#3b82f6; background:transparent; border:none; font-weight:600; font-size:13px; cursor:pointer; border-radius:8px; transition:background .2s; }
    .modifier-btn:hover { background:#eff6ff; }
    .danger-solid-btn { background:#f87171; color:#fff; border:none; border-radius:8px; height:38px; padding:0 20px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; transition:all .2s; }
    .danger-solid-btn:hover { background:#ef4444; }
    .modifier-btn:hover { background:#eff6ff; }
    .voir-btn { display:inline-flex; align-items:center; gap:6px; height:32px; padding:0 14px; border:1.5px solid #3b82f6; border-radius:8px; background:#fff; color:#3b82f6; font-size:13px; font-weight:600; cursor:pointer; transition:all .15s; }
    .voir-btn:hover { background:#eff6ff; }
    .icon-btn { width:36px; padding:0; display:inline-grid; place-items:center; }
    .icon-btn:disabled { cursor:not-allowed; opacity:.45; }
    .primary-btn { background:#2563eb; color:#fff; border-color:#2563eb; }
    .sm-btn { height:38px; font-size:13px; font-weight:500; border-radius:8px; }
    .orange-btn { background:#ff6500; color:#fff; border-color:#ff6500; }
    .success-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; background:#10b981; color:#fff; border-color:#10b981; min-width:100px; }
    .success-btn:hover { background:#059669; border-color:#059669; }
    .danger-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; background:#fff; color:#ef4444; border-color:#fca5a5; min-width:100px; }
    .danger-btn:hover { background:#fef2f2; }
    .danger-solid-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; background:#ef4444; color:#fff; border-color:#ef4444; }
    .week-top, .week-title, .week-actions { display:flex; align-items:center; gap:10px; }
    .week-top { justify-content:space-between; margin-bottom:14px; }
    .week-title small { display:block; color:#607897; font-size:12px; }
    .week-title strong { font-size:15px; font-weight:650; }
    .days-title { display:flex; justify-content:space-between; margin:14px 0 10px; font-size:14px; }
    .days-title span { color:#5b718e; font-size:12px; }
    .week-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px; }
    .day-card { min-height:174px; border:1px solid var(--line); border-radius:7px; overflow:hidden; background:#fff; display:flex; flex-direction:column; }
    .day-card header { height:54px; padding:10px 12px; border-bottom:1px solid #eef2f7; display:flex; justify-content:space-between; }
    .day-card header span { color:#58708e; font-size:12px; } .day-card header b { display:block; font-size:14px; font-weight:650; }
    .day-body { flex:1; padding:12px; font-size:13px; color:#25405f; }
    .day-body p { margin:0 0 10px; }
    .hours { display:flex; align-items:center; gap:5px; color:#155cff; font-weight:650; }
    .hours i-icon { display:flex; color:#155cff; }
    .mode { display:inline-flex; align-items:center; gap:6px; color:#155cff; font-size:12px; } .mode.teletravail { color:#009970; } .mode.hybride { color:#f97316; }
    .task-text { color:#4b6380; font-size:12px; line-height:1.35; }
    .day-card footer { height:34px; border-top:1px solid #eef2f7; display:grid; place-items:center; }
    .pill { display:inline-flex; height:24px; align-items:center; padding:0 10px; border-radius:999px; font-size:12px; background:#eef2f7; }
    .pill.green { background:#dffbea; border:1px solid #86efac; color:#00875a; }
    .pill.blue { background:#dff1ff; color:#006fba; }
    .section-title { margin:22px 0 10px; }
    .report-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:18px; }
    .report-card { display:flex; flex-direction:column; border:1px solid var(--line); border-radius:7px; overflow:hidden; background:#fff; }
    .report-card > span { display:flex; justify-content:space-between; align-items:center; padding:10px 16px; border-bottom:1px solid #eef2f7; font-size:13px; font-weight:620; }
    .report-card em { font-style:normal; color:#ff2d2d; border:1px solid #ffb4b4; border-radius:999px; padding:2px 8px; font-size:11px; font-weight:500; }
    .report-card textarea { border:0; border-radius:0; min-height:85px; padding:10px 16px 14px; font-size:12.5px; line-height:1.5; }
    .report-card.wide { grid-column:span 2; }
    .link-btn { border:none; background:transparent; color:#2563eb; font-size:13px; font-weight:500; cursor:pointer; padding:0; margin:0; }
    .link-btn:hover { text-decoration:underline; }
    .deliverables p { padding:12px; color:#7788a3; font-size:13px; margin:0; }
    .deliverable-row-url { display:flex; align-items:center; gap:8px; padding:8px 12px; border-top:1px solid #eef2f7; }
    .deliverable-row-url input { flex:1; border:0; border-radius:0; height:34px; padding:0; background:transparent; font-size:13px; outline:none; }
    .detail-deliverables { margin-top:16px; }
    .deliverable-list { margin:8px 0 0; padding:0; list-style:none; display:flex; flex-direction:column; gap:6px; }
    .deliverable-list li a { display:inline-flex; align-items:center; gap:6px; color:#2563eb; font-size:13px; text-decoration:none; padding:6px 10px; border:1px solid #dbeafe; border-radius:6px; background:#f0f7ff; max-width:100%; box-sizing:border-box; }
    .deliverable-list li a span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .deliverable-list li a:hover { background:#dbeafe; text-decoration:underline; }
    .detail-heading { padding-bottom:12px; border-bottom:1px solid #eef2f7; margin-bottom:14px; }
    .detail-heading small { color:#607897; }
    .detail-metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:12px 0 14px; }
    .detail-metrics article { border:1px solid var(--line); border-radius:7px; padding:14px 16px; }
    .detail-metrics span { display:block; color:#607897; font-size:12px; margin-bottom:8px; } .detail-metrics strong { font-size:17px; font-weight:650; }
    .detail-report { margin-top:16px; } .detail-report article { border:1px solid var(--line); border-radius:7px; min-height:86px; display:flex; flex-direction:column; } 
    .detail-report h4 { margin:0; padding:8px 12px; font-size:12.5px; font-weight:500; text-align:center; border-bottom:1px solid #eef2f7; color:#475569; background:#f8fafc; }
    .detail-report p { margin:0; padding:8px 12px; font-size:12.5px; flex:1; }
    .timeline { margin:16px 0; padding-left:10px; }
    .timeline div { position:relative; padding:0 0 20px 24px; border-left:2px solid #e2e8f0; }
    .timeline div:last-child { border-left-color:transparent; padding-bottom:0; }
    .timeline span { position:absolute; left:-6px; top:3px; width:10px; height:10px; border-radius:50%; background:#2563eb; outline:4px solid #eff6ff; }
    .timeline div.ev-valide span { background:#10b981; outline-color:#d1fae5; }
    .timeline div.ev-refuse span { background:#ef4444; outline-color:#fee2e2; }
    .timeline b { display:block; font-size:14px; font-weight:650; color:#0f172a; margin-bottom:2px; } 
    .timeline small { display:block; color:#64748b; font-size:12px; font-weight:500; } 
    .timeline p { margin:8px 0 0; color:#475569; font-size:13px; font-style:italic; background:#f8fafc; padding:8px 12px; border-left:3px solid #cbd5e1; border-radius:6px; width:fit-content; max-width:100%; word-break:break-word; }
    .detail-actions, .form-actions { display:flex; justify-content:flex-end; gap:8px; padding-top:14px; border-top:1px solid var(--line); }
    .close-btn { float:right; width:34px; height:34px; border:none; border-radius:8px; background:transparent; color:#526a86; font-size:20px; cursor:pointer; transition:background .2s; }
    .close-btn:hover { background:#f1f5f9; color:#0f172a; }
    .edit-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; padding:18px 0; }
    .edit-grid label { display:flex; flex-direction:column; gap:8px; font-size:13px; color:#294765; }
    .edit-grid textarea, .modes { grid-column:1 / -1; }
    .modes div { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
    .modes button { height:34px; border:1px solid var(--line); border-radius:7px; background:#fff; color:#25405f; }
    .modes button.active { border-color:#2563eb; color:#155cff; background:#eff6ff; }
    .empty { height:88px; color:#7788a3; }
    ::-webkit-scrollbar { width:6px; height:0; } ::-webkit-scrollbar-thumb { background:rgba(15,23,42,.18); border-radius:999px; } ::-webkit-scrollbar-track { background:transparent; }
    @media (max-width: 1100px) { .stats-grid,.rh-stats { grid-template-columns:repeat(2,1fr); } .week-grid { grid-template-columns:repeat(2,1fr); } .report-grid,.detail-metrics { grid-template-columns:1fr; } .report-card.wide { grid-column:auto; } .panel-toolbar,.week-top { align-items:stretch; flex-direction:column; } .search { min-width:0; width:100%; } .data-table { min-width:0; } th,td { padding:8px 6px; font-size:12px; } }
  `],
})
export class TimesheetComponent implements OnInit {
  serviceUnavailable = false;
  current: Timesheet | null = null;
  myHistory: Timesheet[] = [];
  teamSheets: Timesheet[] = [];
  rhSheets: Timesheet[] = [];
  projects: Project[] = [];
  viewMode: 'list' | 'detail' | 'edit' = 'list';
  selectedSheet: Timesheet | null = null;
  editDay: DayInfo | null = null;
  vDept = '';
  vStatus = '';
  rMgr = '';
  rStatus = '';
  search = '';
  statusFilter = '';
  departmentFilter = '';
  managerFilter = '';
  weekStart = this.toIso(this.monday(new Date()));
  report = { faitsMarquants: '', risquesBlocages: '', planSemaineProchaine: '', suggestionsAmeliorations: '' };
  deliverables: Deliverable[] = [];
  editForm: { projectId: number | null; nbHeures: number; workMode: WorkMode; description: string } = { projectId: null, nbHeures: 7, workMode: 'PRESENTIEL', description: '' };
  toastMessage = '';
  toastType: 'success' | 'error' | 'info' = 'info';
  private toastTimer?: number;
  rejectTarget: Timesheet | null = null;
  rejectComment = '';

  constructor(private readonly http: HttpClient, readonly auth: AuthService, private readonly route: ActivatedRoute) { }

  ngOnInit(): void {
    this.reload();
  }

  get role(): Role { return (this.auth.user?.role || 'EMPLOYEE') as Role; }
  get pageTitle(): string { return this.role === 'RH' ? 'Feuille de temps — RH' : this.role === 'MANAGER' ? 'Feuille de temps — Manager' : 'Feuille de temps'; }
  get personalHours(): number { return this.current?.totalHeures || 0; }
  get teamPending(): number { return this.teamSheets.filter(s => s.statut === 'SOUMIS').length; }
  get rhPending(): number { return this.rhSheets.filter(s => s.statut === 'SOUMIS').length; }
  get submissionRate(): number { const done = this.rhSheets.filter(s => s.statut !== 'BROUILLON').length; return done ? Math.round((this.rhSheets.filter(s => s.statut === 'VALIDE').length / done) * 100) : 0; }
  get departments(): string[] { return [...new Set(this.rhSheets.map(s => s.employeeDepartment).filter(Boolean) as string[])]; }
  get managers(): string[] { return [...new Set(this.rhSheets.map(s => s.managerName).filter(Boolean) as string[])].sort(); }
  get filteredRhSheets(): Timesheet[] { return this.filterSheets(this.rhSheets); }
  get rhValidationSheets(): Timesheet[] { return this.rhSheets.filter(s => this.canValidate(s) && (!this.vDept || s.employeeDepartment === this.vDept) && (!this.vStatus || s.statut === this.vStatus)); }
  get rhReadOnlySheets(): Timesheet[] { return this.rhSheets.filter(s => !this.canValidate(s) && (!this.rMgr || (this.rMgr === 'NONE' ? !s.managerName : s.managerName === this.rMgr)) && (!this.rStatus || s.statut === this.rStatus)); }
  get filteredTeamSheets(): Timesheet[] { return this.filterSheets(this.teamSheets); }
  countMySheetsByStatus(status: Status): number { return this.myHistory.filter(s => s.statut === status).length; }

  reload(): void {
    this.serviceUnavailable = false;
    if (this.role === 'RH') {
      this.http.get<Timesheet[]>(`${environment.apiUrl}/api/timesheets/rh/all`).subscribe({ next: r => {
        this.rhSheets = r;
        this.checkViewId(r);
      }, error: () => this.serviceUnavailable = true });
      return;
    }
    this.http.get<Project[]>(`${environment.apiUrl}/api/projects/timesheet-available`).subscribe({ next: r => this.projects = r || [], error: () => this.projects = [] });
    this.http.get<Timesheet>(`${environment.apiUrl}/api/timesheets/week/${this.weekStart}`).subscribe({
      next: r => { this.current = r; this.syncDraft(r); },
      error: () => this.serviceUnavailable = true,
    });
    this.http.get<Timesheet[]>(`${environment.apiUrl}/api/timesheets/my`).subscribe({ next: r => {
      this.myHistory = r || [];
      if (this.role !== 'MANAGER') this.checkViewId(this.myHistory);
    }, error: () => { } });
    if (this.role === 'MANAGER') {
      this.http.get<Timesheet[]>(`${environment.apiUrl}/api/timesheets/manager/pending`).subscribe({ next: r => {
        this.teamSheets = r || [];
        this.checkViewId(this.teamSheets);
      }, error: () => { } });
    }
  }

  private checkViewId(sheets: Timesheet[]): void {
    const viewId = this.route.snapshot.queryParams['viewId'];
    if (viewId) {
      const sheet = sheets.find(s => s.id === Number(viewId));
      if (sheet) this.openDetail(sheet);
    }
  }

  syncDraft(sheet: Timesheet): void {
    this.report = {
      faitsMarquants: sheet.faitsMarquants || '',
      risquesBlocages: sheet.risquesBlocages || '',
      planSemaineProchaine: sheet.planSemaineProchaine || '',
      suggestionsAmeliorations: sheet.suggestionsAmeliorations || '',
    };
    this.deliverables = (sheet.deliverables || []).map(d => ({ label: d.label, url: d.url }));
  }

  shiftWeek(days: number): void {
    const d = new Date(this.weekStart);
    d.setDate(d.getDate() + days);
    if (days > 0 && d > this.monday(new Date())) {
      this.showToast("La saisie d'une semaine future n'est pas autorisée.", 'error');
      return;
    }
    this.weekStart = this.toIso(d);
    this.reload();
  }

  openEdit(day: DayInfo): void {
    if (!this.projects.length) {
      this.showToast('Aucun projet disponible. Contactez votre manager/RH.', 'error');
      return;
    }
    const existing = this.entryFor(day.date);
    this.editDay = day;
    this.editForm = {
      projectId: existing?.projectId || this.projects[0].id,
      nbHeures: existing?.nbHeures || 7,
      workMode: existing?.workMode || 'PRESENTIEL',
      description: existing?.description || '',
    };
    this.toastMessage = '';
    this.viewMode = 'edit';
    document.body.classList.add('panel-open');
  }

  saveDay(): void {
    if (!this.current || !this.editDay) return;
    if (!this.editForm.projectId || this.editForm.nbHeures <= 0 || this.editForm.nbHeures > 7 || !this.editForm.description.trim()) {
      this.showToast('Projet, 1 à 7 heures et description sont obligatoires.', 'error');
      return;
    }

    const doSave = (sheetId: number) => {
      const payload = {
        dateJour: this.editDay!.date,
        entryType: 'PROJET',
        nbHeures: this.editForm.nbHeures,
        workMode: this.editForm.workMode,
        projectId: this.editForm.projectId,
        description: this.editForm.description.trim(),
      };
      this.http.post<Timesheet>(`${environment.apiUrl}/api/timesheets/${sheetId}/entries`, payload).subscribe({
        next: r => {
          this.current = {
            ...r,
            faitsMarquants: this.report.faitsMarquants,
            risquesBlocages: this.report.risquesBlocages,
            planSemaineProchaine: this.report.planSemaineProchaine,
            suggestionsAmeliorations: this.report.suggestionsAmeliorations,
            deliverables: this.deliverables,
          };
          this.closePanel();
          this.refreshHistoryAndTeam();
          this.showToast('Journée enregistrée.', 'success');
        },
        error: e => this.showToast(e?.error?.error || 'Erreur lors de la sauvegarde.', 'error'),
      });
    };

    if (!this.current.id) {
      this.saveDraftOnly((sheet) => doSave(sheet.id));
    } else {
      doSave(this.current.id);
    }
  }

  saveDraftOnly(after?: (sheet: Timesheet) => void): void {
    if (!this.current) return;
    const payload = { ...this.report, deliverables: this.deliverables.filter(d => d.url?.trim()).map(d => ({ label: d.url.trim(), url: d.url.trim() })) };
    this.http.post<Timesheet>(`${environment.apiUrl}/api/timesheets/week/${this.current.semaineDebut}/draft`, payload).subscribe({
      next: r => {
        this.current = r;
        this.syncDraft(r);
        const idx = this.myHistory.findIndex(h => h.id === r.id);
        if (idx !== -1) {
          this.myHistory[idx] = r;
        } else {
          this.http.get<Timesheet[]>(`${environment.apiUrl}/api/timesheets/my`).subscribe({ next: h => this.myHistory = h || [], error: () => { } });
        }
        if (after) after(r);
      },
      error: e => this.showToast(e?.error?.error || 'Erreur lors de la sauvegarde du brouillon.', 'error'),
    });
  }

  submitCurrent(): void {
    this.saveDraftOnly((sheet) => {
      this.http.post<Timesheet>(`${environment.apiUrl}/api/timesheets/${sheet.id}/submit`, {}).subscribe({
        next: () => { this.showToast('Feuille soumise pour validation.', 'success'); this.reload(); },
        error: e => this.showToast(e?.error?.error || 'Soumission impossible.', 'error'),
      });
    });
  }

  openDetail(sheet: Timesheet): void {
    this.selectedSheet = sheet;
    this.viewMode = 'detail';
    setTimeout(() => {
      const content = document.querySelector('.content');
      if (content) content.scrollTo({ top: 0, behavior: 'auto' });
      else window.scrollTo({ top: 0, behavior: 'auto' });
    }, 0);
  }
  closePanel(): void { this.viewMode = 'list'; this.selectedSheet = null; this.editDay = null; document.body.classList.remove('panel-open'); }
  addDeliverable(): void { this.deliverables.push({ label: '', url: '' }); }
  removeDeliverable(i: number): void { this.deliverables.splice(i, 1); this.saveDraftOnly(); }

  approveSheet(sheet: Timesheet): void {
    this.http.post<Timesheet>(`${environment.apiUrl}/api/timesheets/${sheet.id}/approve`, {}).subscribe({
      next: () => { this.showToast('Feuille validée.', 'success'); this.closePanel(); this.reload(); },
      error: e => this.showToast(e?.error?.error || 'Validation impossible.', 'error'),
    });
  }

  rejectSheet(sheet: Timesheet): void {
    this.rejectTarget = sheet;
    this.rejectComment = '';
  }

  cancelReject(): void {
    this.rejectTarget = null;
    this.rejectComment = '';
  }

  confirmReject(): void {
    if (!this.rejectTarget) return;
    const commentaire = this.rejectComment.trim();
    if (!commentaire) {
      this.showToast('Le commentaire de refus est obligatoire.', 'error');
      return;
    }
    this.http.post<Timesheet>(`${environment.apiUrl}/api/timesheets/${this.rejectTarget.id}/reject`, { commentaire }).subscribe({
      next: () => { this.cancelReject(); this.showToast('Feuille refusée.', 'success'); this.closePanel(); this.reload(); },
      error: e => this.showToast(e?.error?.error || 'Refus impossible.', 'error'),
    });
  }

  remindTeam(): void {
    this.http.post<{ count: number }>(`${environment.apiUrl}/api/timesheets/manager/remind-missing`, {}).subscribe({
      next: r => this.showToast(`${r.count} relance(s) envoyée(s).`, 'success'),
      error: e => this.showToast(e?.error?.error || 'Relance impossible.', 'error'),
    });
  }

  canValidate(sheet: Timesheet): boolean {
    if (sheet.statut !== 'SOUMIS') return false;
    if (this.role === 'MANAGER') return sheet.managerId === this.auth.user?.id;
    if (this.role === 'RH') return true; // backend already filters what RH can access
    return false;
  }

  canReopen(sheet: Timesheet): boolean {
    return sheet.statut === 'REJETE' && sheet.employeeId === this.auth.user?.id;
  }

  reopenCurrent(): void {
    if (!this.current) return;
    this.reopenSheet(this.current);
  }

  reopenSheet(sheet: Timesheet): void {
    this.http.post<Timesheet>(`${environment.apiUrl}/api/timesheets/${sheet.id}/reopen`, {}).subscribe({
      next: r => {
        this.weekStart = r.semaineDebut;
        this.selectedSheet = null;
        this.viewMode = 'list';
        this.reload();
        this.showToast('Feuille reprise en brouillon.', 'success');
        setTimeout(() => {
          const content = document.querySelector('.content');
          if (content) content.scrollTo({ top: 0, behavior: 'auto' });
          else window.scrollTo({ top: 0, behavior: 'auto' });
        }, 0);
      },
      error: e => this.showToast(e?.error?.error || 'Reprise impossible.', 'error'),
    });
  }

  canGoNextWeek(): boolean {
    const next = new Date(this.weekStart);
    next.setDate(next.getDate() + 7);
    return next <= this.monday(new Date());
  }

  entryFor(date: string, sheet: Timesheet | null = this.current): Entry | undefined {
    return sheet?.entries?.find(e => e.dateJour === date && e.entryType === 'PROJET');
  }

  projectName(entry?: Entry): string {
    if (!entry?.projectId) return '';
    return entry.projectName || this.projects.find(p => p.id === entry.projectId)?.nom || `Projet #${entry.projectId}`;
  }

  defaultProjectLabel(): string {
    return this.projects.length === 1 ? this.projects[0].nom : '—';
  }

  refreshHistoryAndTeam(): void {
    this.http.get<Timesheet[]>(`${environment.apiUrl}/api/timesheets/my`).subscribe({ next: h => this.myHistory = h || [], error: () => { } });
    if (this.role === 'MANAGER') {
      this.http.get<Timesheet[]>(`${environment.apiUrl}/api/timesheets/manager/pending`).subscribe({ next: r => this.teamSheets = r || [], error: () => { } });
    }
  }

  showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    this.toastMessage = message;
    this.toastType = type;
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastMessage = '', 4200);
  }

  filterSheets(items: Timesheet[]): Timesheet[] {
    const q = this.search.trim().toLowerCase();
    return items.filter(s => {
      const text = `${s.employeeName || ''} ${s.employeeMatricule || ''}`.toLowerCase();
      const matchesSearch = !q || text.includes(q);
      const matchesStatus = !this.statusFilter || s.statut === this.statusFilter;
      const matchesDepartment = !this.departmentFilter || s.employeeDepartment === this.departmentFilter;
      const matchesManager = !this.managerFilter || (this.managerFilter === 'NONE' ? !s.managerName : s.managerName === this.managerFilter);
      return matchesSearch && matchesStatus && matchesDepartment && matchesManager;
    });
  }

  countBy(status: Status): number { return this.rhSheets.filter(s => s.statut === status).length; }
  countTeamBy(status: Status): number { return this.teamSheets.filter(s => s.statut === status).length; }
  anomaly(sheet: Timesheet): string { return sheet.totalHeures < sheet.expectedHours ? `△ ${sheet.expectedHours - sheet.totalHeures}h manquantes` : '—'; }
  displayEmployee(sheet: Timesheet): string { return sheet.employeeName || `Employé #${sheet.employeeId}`; }
  initials(name?: string): string { return (name || 'RH').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase(); }
  statusLabel(s: Status): string { return ({ BROUILLON: 'Brouillon', SOUMIS: 'Soumise', VALIDE: 'Validée', REJETE: 'Refusée' } as Record<Status, string>)[s] || s; }
  statusClass(s: Status): string { return ({ BROUILLON: 'st-draft', SOUMIS: 'st-submitted', VALIDE: 'st-valid', REJETE: 'st-reject' } as Record<Status, string>)[s]; }
  workModeLabel(m?: WorkMode): string { return m === 'TELETRAVAIL' ? 'Télétravail' : m === 'HYBRIDE' ? 'Hybride' : m === 'PRESENTIEL' ? 'Présentiel' : ''; }
  leaveLabel(type?: string): string { return (type || '').replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase()); }
  fmt(value?: number): string { return Number(value || 0).toString().replace('.5', ',5'); }
  shortDate(value?: string): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return `${this.dayShort(this.toIso(d))} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  dayName(date: string): string { return ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][new Date(date).getDay()]; }
  formatEventAction(action: string): string {
    if (!action) return '';
    const l = action.toLowerCase();
    if (l === 'validee') return 'Validée';
    if (l === 'refusee') return 'Refusée';
    if (l === 'soumise') return 'Soumise';
    return action;
  }
  getEventClass(action: string): string {
    if (!action) return '';
    const l = action.toLowerCase();
    if (l === 'validee') return 'ev-valide';
    if (l === 'refusee') return 'ev-refuse';
    return 'ev-default';
  }
  dayShort(date: string): string { const d = new Date(date); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; }
  weekCode(monday: string): string { return `S${this.weekNumber(new Date(monday))}`; }
  weekRange(monday: string): string { const start = new Date(monday); const end = new Date(start); end.setDate(start.getDate() + 4); return `${this.dayShort(this.toIso(start))} → ${this.dayShort(this.toIso(end))}`; }
  monday(d: Date): Date { const c = new Date(d); const day = c.getDay() || 7; c.setDate(c.getDate() - day + 1); return c; }
  toIso(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  weekNumber(d: Date): number { const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const dayNum = date.getUTCDay() || 7; date.setUTCDate(date.getUTCDate() + 4 - dayNum); const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1)); return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7); }
}
