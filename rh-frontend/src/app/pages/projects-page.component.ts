import { Component, OnInit } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { environment } from '../../environments/environment';

@Component({
  standalone: true,
  selector: 'app-projects',
  imports: [NgIf, NgFor, ReactiveFormsModule, FormsModule],
  template: `
    <div class="projects-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Mes Projets</h1>
          <p class="page-subtitle">Gérez vos projets et les affectations de votre équipe</p>
        </div>
        <button class="btn btn-primary btn-with-icon" (click)="showCreateModal = true">
          <span class="icon">+</span> Nouveau Projet
        </button>
      </div>

      <div class="empty-state" *ngIf="projects.length === 0">
        <div class="empty-icon">📂</div>
        <h3>Aucun projet</h3>
        <p>Vous n'avez pas encore créé de projet pour votre équipe.</p>
        <button class="btn btn-ghost" (click)="showCreateModal = true">Créer mon premier projet</button>
      </div>

      <div class="projects-grid">
        <div class="project-card" *ngFor="let p of projects">
          <div class="card-header">
            <h3 class="project-name">{{ p.nom }}</h3>
            <span class="status-badge" [class.active]="p.actif">
              {{ p.actif ? 'Actif' : 'Inactif' }}
            </span>
          </div>
          
          <p class="project-desc">{{ p.description || 'Pas de description fournie pour ce projet.' }}</p>
          
          <div class="members-section">
            <div class="section-title">
              <span>Membres de l'équipe</span>
              <span class="count">{{ p.members?.length || 0 }}</span>
            </div>
            
            <div class="members-list">
              <div class="member-tag" *ngFor="let empId of p.members">
                <span class="member-name">{{ getUserLabel(empId) }}</span>
                <button class="remove-btn" (click)="unassign(p.id, empId)" title="Retirer de ce projet">&times;</button>
              </div>
              <div class="no-members" *ngIf="!p.members || p.members.length === 0">
                Aucun membre affecté
              </div>
            </div>
          </div>

          <div class="card-footer">
            <div class="assign-box">
              <select class="assign-select" [(ngModel)]="selectedEmployeeToAssign[p.id]">
                <option [ngValue]="undefined">Affecter un employé...</option>
                <option *ngFor="let u of availableUsers" [ngValue]="u.id">{{ u.nom }} {{ u.prenom }}</option>
              </select>
              <button class="btn btn-primary btn-sm" (click)="assign(p.id)" [disabled]="!selectedEmployeeToAssign[p.id]">
                Ajouter
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- CREATE MODAL -->
    <div class="modal-overlay" *ngIf="showCreateModal" (click)="showCreateModal = false">
      <div class="modal-card" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>Nouveau Projet</h3>
          <button class="close-modal" (click)="showCreateModal = false">&times;</button>
        </div>
        <form [formGroup]="createForm" (ngSubmit)="createProject()">
          <div class="modal-body">
            <div class="form-field">
              <label>Nom du projet</label>
              <input formControlName="nom" placeholder="Ex: Refonte Dashboard RH" />
            </div>
            <div class="form-field">
              <label>Description</label>
              <textarea rows="4" formControlName="description" placeholder="Objectifs et contexte du projet..."></textarea>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-ghost" type="button" (click)="showCreateModal = false">Annuler</button>
            <button class="btn btn-primary" type="submit" [disabled]="createForm.invalid">Créer le Projet</button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [
    `
      .projects-container {
        padding: 24px;
        max-width: 1200px;
        margin: 0 auto;
      }

      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 32px;
      }

      .page-title {
        font-size: 24px;
        font-weight: 700;
        color: var(--rh-slate);
        margin: 0;
      }

      .page-subtitle {
        color: #64748b;
        margin-top: 4px;
        font-size: 14px;
      }

      .btn-with-icon {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 20px;
      }

      .projects-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
        gap: 24px;
      }

      .project-card {
        background: #fff;
        border-radius: 16px;
        border: 1px solid #e2e8f0;
        padding: 24px;
        display: flex;
        flex-direction: column;
        transition: all 0.2s ease;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      }

      .project-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        border-color: var(--rh-blue);
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 12px;
      }

      .project-name {
        font-size: 18px;
        font-weight: 600;
        color: var(--rh-slate);
        margin: 0;
        flex: 1;
      }

      .status-badge {
        padding: 4px 12px;
        border-radius: 99px;
        font-size: 12px;
        font-weight: 600;
        background: #f1f5f9;
        color: #64748b;
      }

      .status-badge.active {
        background: #d1fae5;
        color: #065f46;
        border: 1px solid #10b981;
      }

      .project-desc {
        font-size: 14px;
        color: #475569;
        line-height: 1.5;
        margin-bottom: 24px;
        flex-grow: 1;
      }

      .members-section {
        border-top: 1px dashed #e2e8f0;
        padding-top: 16px;
        margin-bottom: 20px;
      }

      .section-title {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.025em;
        margin-bottom: 12px;
      }

      .section-title .count {
        background: #f1f5f9;
        padding: 2px 8px;
        border-radius: 6px;
      }

      .members-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .member-tag {
        display: flex;
        align-items: center;
        gap: 6px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        padding: 4px 8px 4px 12px;
        border-radius: 8px;
        font-size: 13px;
        color: var(--rh-slate);
      }

      .remove-btn {
        background: none;
        border: none;
        color: #94a3b8;
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        border-radius: 4px;
        line-height: 1;
      }

      .remove-btn:hover {
        background: #fee2e2;
        color: #dc2626;
      }

      .no-members {
        font-style: italic;
        color: #94a3b8;
        font-size: 13px;
      }

      .card-footer {
        margin-top: auto;
      }

      .assign-box {
        display: flex;
        gap: 8px;
      }

      .assign-select {
        flex: 1;
        font-size: 13px;
        height: 38px;
        padding: 0 12px;
      }

      .btn-sm {
        padding: 0 16px;
        height: 38px;
        font-size: 13px;
      }

      /* Empty State */
      .empty-state {
        text-align: center;
        padding: 60px 20px;
        background: #fff;
        border-radius: 16px;
        border: 2px dashed #e2e8f0;
      }

      .empty-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }

      .empty-state h3 {
        margin: 0 0 8px 0;
        color: var(--rh-slate);
      }

      .empty-state p {
        color: #64748b;
        margin-bottom: 24px;
      }

      /* Modal Enhancement */
      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.5);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        animation: fadeIn 0.2s ease;
      }

      .modal-card {
        background: #fff;
        width: 100%;
        max-width: 500px;
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        animation: slideUp 0.3s ease;
      }

      .modal-header {
        padding: 20px 24px;
        border-bottom: 1px solid #f1f5f9;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .modal-header h3 {
        margin: 0;
        color: var(--rh-slate);
        font-size: 18px;
      }

      .close-modal {
        background: #f1f5f9;
        border: none;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        color: #64748b;
        cursor: pointer;
      }

      .modal-body {
        padding: 24px;
      }

      .form-field {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 20px;
      }

      .form-field label {
        font-size: 14px;
        font-weight: 600;
        color: #475569;
      }

      .modal-actions {
        padding: 16px 24px;
        background: #f8fafc;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `,
  ],
})
export class ProjectsComponent implements OnInit {
  projects: any[] = [];
  usersMap: Map<number, any> = new Map();
  availableUsers: any[] = [];

  showCreateModal = false;
  createForm = this.fb.nonNullable.group({
    nom: ['', Validators.required],
    description: [''],
  });

  selectedEmployeeToAssign: { [projectId: number]: number | undefined } = {};

  constructor(
    readonly auth: AuthService,
    private readonly http: HttpClient,
    private readonly fb: FormBuilder
  ) {}

  ngOnInit(): void {
    if (this.auth.user?.role !== 'MANAGER') {
      return;
    }
    this.loadUsers();
    this.loadProjects();
  }

  loadUsers(): void {
    this.http.get<any[]>(`${environment.apiUrl}/api/users`).subscribe({
      next: (users) => {
        // Filter users that belong to this manager's team
        // Assuming /api/users returns all users, we map them and filter
        // Better: The backend could provide /api/users/team but we use what we have
        this.availableUsers = users.filter(u => u.managerId === this.auth.user?.id);
        users.forEach(u => this.usersMap.set(u.id, u));
      },
      error: () => {}
    });
  }

  loadProjects(): void {
    this.http.get<any[]>(`${environment.apiUrl}/api/projects/mine`).subscribe({
      next: (p) => { this.projects = p; },
      error: () => {}
    });
  }

  createProject(): void {
    if (this.createForm.invalid) return;
    this.http.post(`${environment.apiUrl}/api/projects`, this.createForm.getRawValue()).subscribe({
      next: () => {
        this.showCreateModal = false;
        this.createForm.reset();
        this.loadProjects();
      },
      error: (e) => alert('Erreur création projet')
    });
  }

  assign(projectId: number): void {
    const empId = this.selectedEmployeeToAssign[projectId];
    if (!empId) return;
    this.http.post(`${environment.apiUrl}/api/projects/${projectId}/assign/${empId}`, {}).subscribe({
      next: () => {
        this.selectedEmployeeToAssign[projectId] = undefined;
        this.loadProjects();
      },
      error: (e) => alert(e?.error?.error || 'Erreur affectation')
    });
  }

  unassign(projectId: number, empId: number): void {
    if (!confirm('Retirer cet employé du projet ?')) return;
    this.http.delete(`${environment.apiUrl}/api/projects/${projectId}/assign/${empId}`).subscribe({
      next: () => this.loadProjects(),
      error: (e) => alert('Erreur retrait')
    });
  }

  getUserLabel(id: number): string {
    const u = this.usersMap.get(id);
    return u ? `${u.nom} ${u.prenom}` : `Employé #${id}`;
  }
}
