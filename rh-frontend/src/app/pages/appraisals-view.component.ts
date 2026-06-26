import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Appraisal, AppraisalStatus } from './appraisal.model';
import { AppraisalService } from './appraisal.service';
import { AppraisalGridConfigurationComponent } from './appraisal-grid-configuration.component';

@Component({
  standalone: true,
  selector: 'app-appraisals-view',
  imports: [CommonModule, FormsModule, AppraisalGridConfigurationComponent],
  template: `
    <div class="rh-page" [class.detail-active]="selected">
      <nav class="rh-tabs" aria-label="Sections des appréciations RH" *ngIf="!selected">
        <div class="rh-tabs-container">
          <button type="button" [class.active]="activeTab === 'VALIDATION'" (click)="activeTab = 'VALIDATION'">Appréciations</button>
          <button type="button" [class.active]="activeTab === 'GRIDS'" (click)="activeTab = 'GRIDS'">Configuration des grilles</button>
        </div>
      </nav>
      
      <!-- Toast Notifications -->
      <div class="toast-notification toast-error" *ngIf="error">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>{{ error }}</span>
      </div>
      <div class="toast-notification toast-success" *ngIf="success">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <span>{{ success }}</span>
      </div>

      <ng-container *ngIf="activeTab === 'VALIDATION'; else gridConfiguration">
        <ng-container *ngIf="!selected; else detailView">
          <div class="validation-scroll">
            <div class="validation-container">

              <section class="filters-container">
                <div class="search-wrapper">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  <input [(ngModel)]="searchFilter" placeholder="Rechercher un employé, un manager...">
                </div>
                <div class="select-wrapper">
                  <select [(ngModel)]="departmentFilter">
                    <option value="">Tous les départements</option>
                    <option *ngFor="let department of departments" [value]="department">{{ department }}</option>
                  </select>
                </div>
                <div class="select-wrapper">
                  <select [(ngModel)]="statusFilter">
                    <option value="">Tous les statuts</option>
                    <option value="SOUMIS">En attente employé</option>
                    <option value="PRISE_CONNAISSANCE">Prête à valider</option>
                    <option value="VALIDEE_RH">Validée RH</option>
                  </select>
                </div>
                <button type="button" class="btn-reset" (click)="resetFilters()">Réinitialiser</button>
              </section>

              <section class="panel list-panel">
                <div class="empty" *ngIf="filteredRows.length === 0">Aucune appréciation ne correspond aux filtres.</div>
                <div class="table-scroll" *ngIf="filteredRows.length">
                  <table class="appraisals-table">
                    <thead>
                      <tr>
                        <th>EMPLOYÉ</th>
                        <th>MANAGER</th>
                        <th>DÉPARTEMENT</th>
                        <th>PÉRIODE</th>
                        <th>POSITIONNEMENT RH</th>
                        <th>STATUT</th>
                        <th class="col-action"></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let item of filteredRows">
                        <td class="col-employee">
                          <div class="employee-cell">
                            <div class="avatar" [ngStyle]="{'background-color': getAvatarColor(item.employeeName).bg, 'color': getAvatarColor(item.employeeName).text}">
                              {{ getInitials(item.employeeName) }}
                            </div>
                            <span class="employee-name" [title]="item.employeeName">{{ item.employeeName }}</span>
                          </div>
                        </td>
                        <td>{{ item.managerName }}</td>
                        <td>{{ item.employeeDepartment || '—' }}</td>
                        <td>{{ item.periode }}</td>
                        <td>{{ item.positioningCategory || '—' }}</td>
                        <td>
                          <span class="status-badge" [attr.data-status]="item.statut">
                            {{ statusLabel(item.statut) }}
                          </span>
                        </td>
                        <td class="col-action">
                          <button class="btn-icon-action" type="button" (click)="selected = item" title="Consulter">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        </ng-container>
      </ng-container>

      <ng-template #detailView>
        <div class="detail-page-container" *ngIf="selected as item">
          <div class="detail-fixed-header">
            <div class="header-content-inner">
              <div class="header-top-row">
                <div class="employee-profile">
                  <div class="avatar large-avatar" [ngStyle]="{'background-color': getAvatarColor(item.employeeName).bg, 'color': getAvatarColor(item.employeeName).text}">
                    {{ getInitials(item.employeeName) }}
                  </div>
                  <div class="profile-info">
                    <h2>{{ item.employeeName }}</h2>
                    <div class="subtitle">
                      <span>{{ item.employeePoste || 'SM Manager' }}</span>
                      <span class="separator">•</span>
                      <span>{{ item.employeeDepartment || 'Marketing' }}</span>
                      <span class="separator">•</span>
                      <span>{{ item.periode }}</span>
                    </div>
                  </div>
                </div>
                <div class="header-actions">
                  <span class="status-badge" [attr.data-status]="item.statut">
                    {{ statusLabel(item.statut) }}
                  </span>
                  <button class="btn-close" type="button" (click)="selected = null" aria-label="Fermer la fiche">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </div>
              </div>
              
              <div class="metadata-context-row">
                <div class="metadata-item">
                  <span class="meta-label">MANAGER</span>
                  <strong class="meta-value">{{ item.managerName }}</strong>
                </div>
                <div class="metadata-item">
                  <span class="meta-label">PERFORMANCE</span>
                  <strong class="meta-value">{{ performanceLabel(item.performance) }}</strong>
                </div>
                <div class="metadata-item">
                  <span class="meta-label">POTENTIEL</span>
                  <strong class="meta-value">{{ potentialLabel(item.potential) }}</strong>
                </div>
                <div class="metadata-item">
                  <span class="meta-label">POSITIONNEMENT RH</span>
                  <strong class="meta-value text-blue">{{ item.positioningCategory || '—' }}</strong>
                </div>
              </div>
            </div>
          </div>
          
          <div class="detail-body-scroll">
            <div class="detail-body-container">

              <section class="detail-panel">
                <div class="panel-header">
                  <h3>Grille évaluée</h3>
                  <span class="criteria-count">{{ item.answers.length }} critères</span>
                </div>
                <div class="answer-item" *ngFor="let answer of item.answers">
                  <div class="answer-left">
                    <h4>{{ answer.criterionLabel }}</h4>
                    <p class="criterion-desc">{{ answer.criterionDescription }}</p>
                    <p class="answer-comment" *ngIf="answer.comment">« {{ answer.comment }} »</p>
                  </div>
                  <div class="answer-right">
                    <span class="level-badge" [attr.data-level]="answer.level">{{ levelLabel(answer.level) }}</span>
                  </div>
                </div>
              </section>

              <section class="detail-panel">
                <h3>Synthèse</h3>
                <p class="summary-text">{{ item.generatedSummary }}</p>
                <div class="panel-comment-section" *ngIf="item.managerComment">
                  <strong>COMMENTAIRE MANAGER</strong>
                  <p>{{ item.managerComment }}</p>
                </div>
                <div class="panel-comment-section" *ngIf="item.employeeComment">
                  <strong>COMMENTAIRE EMPLOYÉ</strong>
                  <p>{{ item.employeeComment }}</p>
                </div>
              </section>

              <section class="detail-panel">
                <h3>Workflow de validation</h3>
                <div class="workflow-steps">
                  <div class="workflow-step done">
                    <div class="step-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                    </div>
                    <div class="step-info">
                      <strong>Manager</strong>
                      <span>{{ item.submittedAt ? 'Soumis le ' + formatDate(item.submittedAt) : 'Soumis' }}</span>
                    </div>
                  </div>
                  <div class="workflow-step" [class.done]="item.statut === 'PRISE_CONNAISSANCE' || item.statut === 'VALIDEE_RH'" [class.active]="item.statut === 'SOUMIS'">
                    <div class="step-icon">
                      <svg *ngIf="item.statut === 'PRISE_CONNAISSANCE' || item.statut === 'VALIDEE_RH'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                    </div>
                    <div class="step-info">
                      <strong>Employé</strong>
                      <span>{{ item.employeeAcknowledgedAt ? 'A pris connaissance le ' + formatDate(item.employeeAcknowledgedAt) : (item.statut === 'SOUMIS' ? 'En attente' : 'A pris connaissance') }}</span>
                    </div>
                  </div>
                  <div class="workflow-step" [class.active]="item.statut === 'PRISE_CONNAISSANCE'" [class.done]="item.statut === 'VALIDEE_RH'">
                    <div class="step-icon">
                      <svg *ngIf="item.statut === 'VALIDEE_RH'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                    </div>
                    <div class="step-info">
                      <strong>RH</strong>
                      <span>{{ item.rhValidatedAt ? 'Validée le ' + formatDate(item.rhValidatedAt) : (item.statut === 'VALIDEE_RH' ? 'Validée' : item.statut === 'PRISE_CONNAISSANCE' ? 'Prêt à valider' : 'En attente') }}</span>
                    </div>
                  </div>
                </div>
                
                <div class="validation-action-container" *ngIf="item.statut === 'PRISE_CONNAISSANCE'">
                  <button class="btn-validate-rh" type="button" (click)="validate(item)">Valider administrativement</button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </ng-template>

      <ng-template #gridConfiguration>
        <app-appraisal-grid-configuration></app-appraisal-grid-configuration>
      </ng-template>
    </div>
  `,
  styles: [`
    ::ng-deep .content:has(.rh-page) { padding: 0 !important; overflow: hidden !important; }
    :host { display: block; height: 100%; min-height: 0; }
    .rh-page {
      width: 100%;
      height: 100%;
      min-height: 0;
      display: flex;
      flex-direction: column;
      background: #f8fafc;
      overflow: hidden;
      font-family: inherit;
    }
    
    /* Toast popup styling */
    .toast-notification {
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 9999;
      background: #ffffff;
      border-radius: 8px;
      padding: 12px 20px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
      font-weight: 500;
      animation: slideIn 0.3s ease-out forwards;
    }
    .toast-success { border-left: 4px solid #10b981; color: #065f46; }
    .toast-success svg { color: #10b981; }
    .toast-error { border-left: 4px solid #ef4444; color: #991b1b; }
    .toast-error svg { color: #ef4444; }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    /* Restored Header Tabs */
    .rh-tabs { background: #ffffff; border-bottom: 1px solid #e2e8f0; display: flex; height: 60px; align-items: stretch; flex-shrink: 0; }
    .rh-tabs-container { width: 100%; padding: 0 32px; display: flex; gap: 24px; }
    .rh-tabs button { border: 0; border-bottom: 2px solid transparent; background: transparent; padding: 0; color: #64748b; font-weight: 400; cursor: pointer; display: flex; align-items: center; font-size: 14px;}
    .rh-tabs button.active { border-bottom-color: #2563eb; color: #0f172a; font-weight: 500; }
    
    /* List View Scroll Section */
    .validation-scroll {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 24px 0 40px;
      scrollbar-width: thin;
      scrollbar-color: #cbd5e1 transparent;
    }
    .validation-scroll::-webkit-scrollbar { width: 5px; }
    .validation-scroll::-webkit-scrollbar-track { background: transparent; }
    .validation-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 8px; }
    .validation-container { max-width: 1120px; width: 100%; margin: 0 auto; padding: 0 40px; box-sizing: border-box; }
    
    /* Filters Container Style */
    .filters-container {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 24px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 1px 3px 0 rgba(0,0,0,0.02);
      box-sizing: border-box;
    }
    .search-wrapper {
      position: relative;
      flex: 1;
      display: flex;
      align-items: center;
    }
    .search-wrapper input {
      width: 100%;
      padding: 10px 12px 10px 40px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
      transition: all 0.2s;
      color: #1e293b;
      background: #ffffff;
    }
    .search-wrapper input::placeholder { color: #94a3b8; }
    .search-wrapper input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
    .search-icon { position: absolute; left: 14px; }
    .select-wrapper { position: relative; width: 220px; }
    .select-wrapper select {
      width: 100%;
      padding: 10px 36px 10px 16px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      background-color: #ffffff;
      appearance: none;
      outline: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      background-size: 16px;
      color: #1e293b;
      cursor: pointer;
      transition: all 0.2s;
    }
    .select-wrapper select:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
    .btn-reset { background: transparent; border: none; color: #64748b; font-weight: 500; font-size: 14px; cursor: pointer; padding: 8px 12px; transition: color 0.2s; }
    .btn-reset:hover { color: #2563eb; }
    
    /* Table Redesign */
    .list-panel {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.02);
      overflow: hidden;
      margin-top: 0;
      padding: 0;
    }
    .table-scroll { width: 100%; overflow-x: auto; overflow-y: hidden; }
    .appraisals-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 13px; /* Reduced font size to avoid zoom effect */
    }
    .appraisals-table th {
      background: #f8fafc;
      padding: 12px 16px;
      font-weight: 600;
      font-size: 11px;
      color: #64748b;
      letter-spacing: 0.05em;
      border-bottom: 1px solid #e2e8f0;
      white-space: nowrap; /* Prevent headers like POSITIONNEMENT RH from wrapping */
    }
    .appraisals-table td {
      padding: 12px 16px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
      vertical-align: middle;
    }
    .appraisals-table tr:last-child td { border-bottom: none; }
    
    .employee-cell { display: flex; align-items: center; gap: 12px; }
    .avatar {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 11px;
      flex-shrink: 0;
    }
    .employee-name { font-weight: 600; color: #0f172a; }
    
    /* Status Badge styling */
    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 500;
      line-height: 1;
    }
    .status-badge[data-status="VALIDEE_RH"] { background: #ecfdf5; color: #15803d; border: 1px solid #d1fae5; }
    .status-badge[data-status="PRISE_CONNAISSANCE"] { background: #eff6ff; color: #1d4ed8; border: 1px solid #dbeafe; }
    .status-badge[data-status="SOUMIS"] { background: #fffbeb; color: #b45309; border: 1px solid #fef3c7; }
    
    /* Icon action button */
    .col-action { width: 50px; text-align: right; padding-right: 24px !important; }
    .btn-icon-action {
      background: transparent;
      border: 1px solid transparent;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      color: #64748b;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    .btn-icon-action:hover {
      background: #f1f5f9;
      color: #0f172a;
    }
    
    /* Detail Page Container Styles */
    .detail-page-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      background: #f8fafc;
      overflow: hidden;
    }
    .detail-fixed-header { background: #ffffff; border-bottom: 1px solid #e2e8f0; flex-shrink: 0; }
    .header-content-inner { max-width: 1120px; margin: 0 auto; padding: 0 40px; box-sizing: border-box; }
    .header-top-row { padding: 24px 0 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; }
    .employee-profile { display: flex; align-items: center; gap: 16px; }
    .large-avatar { width: 44px; height: 44px; font-size: 16px; border-radius: 50%; }
    .profile-info h2 { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0; }
    .profile-info .subtitle { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #64748b; }
    .separator { color: #cbd5e1; }
    .header-actions { display: flex; align-items: center; gap: 12px; }
    .btn-close { width: 36px; height: 36px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; color: #64748b; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
    .btn-close:hover { background: #f8fafc; color: #0f172a; border-color: #cbd5e1; }
    
    /* Fixed Metadata row in header */
    .metadata-context-row { padding: 16px 0 20px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
    .metadata-item { display: flex; flex-direction: column; gap: 4px; }
    .meta-label { font-size: 11px; font-weight: 600; color: #64748b; letter-spacing: 0.05em; }
    .meta-value { font-size: 14px; font-weight: 600; color: #1e293b; }
    .text-blue { color: #2563eb; }
    
    /* Scrollable Body area */
    .detail-body-scroll { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
    .detail-body-scroll::-webkit-scrollbar { width: 6px; }
    .detail-body-scroll::-webkit-scrollbar-track { background: transparent; }
    .detail-body-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
    .detail-body-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
    
    .detail-body-container { max-width: 1120px; margin: 0 auto; padding: 24px 40px 48px; display: flex; flex-direction: column; gap: 24px; box-sizing: border-box; }
    
    /* Panels layout inside detail view */
    .detail-panel { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.02); box-sizing: border-box; }
    .detail-panel h3 { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0; }
    .panel-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 12px; }
    .panel-header h3 { margin: 0; }
    .criteria-count { font-size: 13px; color: #64748b; font-weight: 500; }
    
    /* Answer lists inside evaluations */
    .answer-item { display: flex; justify-content: space-between; align-items: flex-start; padding: 16px 0; border-bottom: 1px solid #f1f5f9; gap: 20px; }
    .answer-item:last-child { border-bottom: none; padding-bottom: 0; }
    .answer-item:first-of-type { padding-top: 0; }
    .answer-left { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .answer-left h4 { font-size: 14px; font-weight: 600; color: #1e293b; margin: 0; }
    .criterion-desc { font-size: 13px; color: #64748b; margin: 0; }
    .answer-comment { font-size: 13px; color: #475569; margin: 8px 0 0 0; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border-left: 3px solid #cbd5e1; }
    .answer-right { flex-shrink: 0; }
    
    /* Evaluation levels */
    .level-badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 500; text-align: center; line-height: 1; }
    .level-badge[data-level="A_RENFORCER"] { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    .level-badge[data-level="EN_PROGRESSION"] { background: #fffbeb; color: #b45309; border: 1px solid #fef3c7; }
    .level-badge[data-level="CONFORME"] { background: #eff6ff; color: #1d4ed8; border: 1px solid #dbeafe; }
    .level-badge[data-level="POINT_FORT"] { background: #ecfdf5; color: #15803d; border: 1px solid #d1fae5; }
    
    /* Synthesis comments section */
    .summary-text { font-size: 14px; line-height: 1.6; color: #334155; margin: 0; }
    .panel-comment-section { margin-top: 16px; padding-top: 16px; border-top: 1px solid #f1f5f9; }
    .panel-comment-section strong { font-size: 11px; font-weight: 600; color: #64748b; letter-spacing: 0.05em; display: block; margin-bottom: 6px; }
    .panel-comment-section p { font-size: 14px; color: #334155; margin: 0; background: #f8fafc; padding: 12px 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
    
    /* Workflow Validation Steps */
    .workflow-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .workflow-step { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; display: flex; align-items: center; gap: 12px; transition: all 0.2s; }
    .workflow-step .step-icon { width: 24px; height: 24px; border-radius: 50%; background: #f1f5f9; color: #64748b; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .workflow-step .step-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .workflow-step .step-info strong { font-size: 14px; color: #334155; }
    .workflow-step .step-info span { font-size: 12px; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    
    .workflow-step.done { background: #f0fdf4; border-color: #bbf7d0; }
    .workflow-step.done .step-icon { background: #22c55e; color: #ffffff; }
    .workflow-step.done .step-info strong { color: #14532d; }
    .workflow-step.done .step-info span { color: #15803d; }
    
    .workflow-step.active { background: #eff6ff; border-color: #bfdbfe; box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.05); }
    .workflow-step.active .step-icon { background: #2563eb; color: #ffffff; }
    .workflow-step.active .step-info strong { color: #1e3a8a; }
    .workflow-step.active .step-info span { color: #1d4ed8; }
    
    /* Premium Admin validate button */
    .validation-action-container { margin-top: 24px; display: flex; justify-content: flex-end; }
    .btn-validate-rh {
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s, transform 0.1s;
      box-shadow: 0 1px 2px rgba(37, 99, 235, 0.2);
      font-family: inherit;
    }
    .btn-validate-rh:hover { background: #1d4ed8; }
    
    .empty { text-align: center; color: #64748b; padding: 32px; font-size: 14px; }
    
    @media (max-width: 768px) {
      .filters-container { flex-direction: column; align-items: stretch; }
      .select-wrapper { width: 100%; }
      .metadata-context-row { grid-template-columns: 1fr 1fr; gap: 16px; }
      .workflow-steps { grid-template-columns: 1fr; }
    }
  `],
})
export class AppraisalsViewComponent implements OnInit {
  activeTab: 'VALIDATION' | 'GRIDS' = 'VALIDATION';
  rows: Appraisal[] = [];
  selected: Appraisal | null = null;
  searchFilter = '';
  periodFilter = '';
  departmentFilter = '';
  statusFilter: AppraisalStatus | '' = '';
  error: string | null = null;
  success: string | null = null;

  constructor(private readonly service: AppraisalService) {}

  ngOnInit(): void {
    this.reload();
  }

  getInitials(name: string): string {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  getAvatarColor(name: string): { bg: string, text: string } {
    const colors = [
      { bg: '#eff6ff', text: '#1e40af' }, // Blue
      { bg: '#ecfdf5', text: '#047857' }, // Green
      { bg: '#fffbeb', text: '#b45309' }, // Amber
      { bg: '#fdf2f8', text: '#be185d' }, // Pink
      { bg: '#fbf7ff', text: '#6b21a8' }, // Purple
      { bg: '#f0fdfa', text: '#0f766e' }, // Teal
    ];
    if (!name) return colors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  formatDate(dateStr?: string | null): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '';
    }
  }

  resetFilters(): void {
    this.searchFilter = '';
    this.departmentFilter = '';
    this.statusFilter = '';
    this.periodFilter = '';
  }

  get departments(): string[] {
    return [...new Set(this.rows.map(row => row.employeeDepartment).filter((value): value is string => !!value))].sort();
  }

  get filteredRows(): Appraisal[] {
    const search = this.searchFilter.trim().toLowerCase();
    const period = this.periodFilter.trim().toLowerCase();
    return this.rows.filter(row => {
      const matchSearch = !search || 
        row.employeeName.toLowerCase().includes(search) || 
        row.managerName.toLowerCase().includes(search) ||
        row.periode.toLowerCase().includes(search) ||
        (row.employeeDepartment && row.employeeDepartment.toLowerCase().includes(search));
      const matchPeriod = !period || row.periode.toLowerCase().includes(period);
      const matchDept = !this.departmentFilter || row.employeeDepartment === this.departmentFilter;
      const matchStatus = !this.statusFilter || row.statut === this.statusFilter;
      return matchSearch && matchPeriod && matchDept && matchStatus;
    });
  }

  reload(): void {
    this.service.rhList().subscribe({
      next: rows => this.rows = rows,
      error: e => {
        this.error = e?.error?.error ?? 'Chargement impossible.';
        setTimeout(() => this.error = null, 3000);
      }
    });
  }

  validate(item: Appraisal): void {
    this.error = null;
    this.service.validateRh(item.id).subscribe({
      next: updated => {
        this.selected = updated;
        this.success = 'Appréciation validée et verrouillée.';
        setTimeout(() => this.success = null, 3000);
        this.reload();
      },
      error: e => {
        this.error = e?.error?.error ?? 'Validation impossible.';
        setTimeout(() => this.error = null, 3000);
      }
    });
  }

  statusLabel(status: string): string {
    return ({ BROUILLON: 'Brouillon', SOUMIS: 'En attente employé', PRISE_CONNAISSANCE: 'Prête à valider', VALIDEE_RH: 'Validée RH' } as Record<string, string>)[status] ?? status;
  }

  levelLabel(level: string): string {
    return ({ A_RENFORCER: 'À renforcer', EN_PROGRESSION: 'En progression', CONFORME: 'Conforme', POINT_FORT: 'Point fort' } as Record<string, string>)[level] ?? level;
  }

  performanceLabel(value?: string | null): string {
    return ({ A_RENFORCER: 'À renforcer', CONFORME: 'Conforme aux attentes', SUPERIEURE: 'Supérieure aux attentes' } as Record<string, string>)[value ?? ''] ?? '—';
  }

  potentialLabel(value?: string | null): string {
    return ({ A_CONFIRMER: 'À confirmer', EVOLUTIF: 'Évolutif', FORT: 'Fort potentiel' } as Record<string, string>)[value ?? ''] ?? '—';
  }
}
