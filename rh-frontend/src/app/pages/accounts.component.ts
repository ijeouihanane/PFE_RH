import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { environment } from '../../environments/environment';
import { IIconComponent } from '../core/i-icon.component';

type Tab = 'pending' | 'active' | 'disabled';
type ConfirmAction = 'create' | 'reset' | 'deactivate' | 'reactivate';
type RoleFilter = 'ALL' | 'EMPLOYEE' | 'MANAGER';

type AccountUser = {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  role: 'EMPLOYEE' | 'MANAGER';
  actif: boolean;
  firstLogin: boolean;
  matricule?: string | null;
  poste?: string | null;
  departement?: string | null;
  managerId?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastLogin?: string | null;
};

type AccountResult = {
  userId: number;
  email: string;
  emailQueued: boolean;
  firstLogin: boolean;
};

@Component({
  standalone: true,
  selector: 'app-accounts',
  imports: [CommonModule, FormsModule, IIconComponent],
  templateUrl: './accounts.component.html',
  styleUrl: './accounts.component.scss',
})
export class AccountsComponent implements OnInit {
  tab: Tab = 'pending';
  search = '';
  roleFilter: RoleFilter = 'ALL';
  loading = false;
  error: string | null = null;
  toast: { type: 'success' | 'error'; message: string } | null = null;
  private toastTimeout: any;
  detailsUser: AccountUser | null = null;
  confirm: { action: ConfirmAction; user: AccountUser } | null = null;

  accounts: Record<Tab, AccountUser[]> = {
    pending: [],
    active: [],
    disabled: [],
  };

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.error = null;
    forkJoin({
      pending: this.http.get<AccountUser[]>(`${environment.apiUrl}/api/users/admin/pending`),
      active: this.http.get<AccountUser[]>(`${environment.apiUrl}/api/users/admin/active`),
      disabled: this.http.get<AccountUser[]>(`${environment.apiUrl}/api/users/admin/disabled`),
    }).subscribe({
      next: (data) => {
        this.accounts = data;
        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de charger les comptes. Reessayez.';
        this.loading = false;
      },
    });
  }

  setTab(tab: Tab): void {
    this.tab = tab;
    this.search = '';
    this.roleFilter = 'ALL';
  }

  get rows(): AccountUser[] {
    const term = this.search.trim().toLowerCase();
    return this.accounts[this.tab].filter((u) => {
      const byRole = this.roleFilter === 'ALL' || u.role === this.roleFilter;
      const haystack = `${u.prenom} ${u.nom} ${u.email} ${u.matricule || ''}`.toLowerCase();
      return byRole && (!term || haystack.includes(term));
    });
  }

  count(tab: Tab): number {
    return this.accounts[tab].length;
  }

  openConfirm(action: ConfirmAction, user: AccountUser): void {
    this.confirm = { action, user };
  }

  closeConfirm(): void {
    this.confirm = null;
  }

  runConfirm(): void {
    if (!this.confirm) return;
    const { action, user } = this.confirm;
    this.closeConfirm();

    const url =
      action === 'create'
        ? `${environment.apiUrl}/api/users/admin/${user.id}/create-account`
        : action === 'reset'
          ? `${environment.apiUrl}/api/users/admin/${user.id}/reset-password`
          : action === 'deactivate'
            ? `${environment.apiUrl}/api/users/admin/${user.id}/deactivate`
            : `${environment.apiUrl}/api/users/admin/${user.id}/reactivate`;

    this.http.post<AccountResult | void>(url, {}).subscribe({
      next: (result) => {
        this.showSuccess(action, user, result as AccountResult | undefined);
        this.reload();
      },
      error: (e) => {
        const message = e?.error?.message || e?.error?.error || 'Action impossible pour le moment.';
        this.showToast('error', message);
      },
    });
  }

  openDetails(user: AccountUser): void {
    this.detailsUser = user;
  }

  closeDetails(): void {
    this.detailsUser = null;
  }

  fullName(user: AccountUser): string {
    return `${user.prenom || ''} ${user.nom || ''}`.trim();
  }

  initials(user: AccountUser): string {
    return `${user.prenom?.[0] || ''}${user.nom?.[0] || ''}`.toUpperCase() || 'RH';
  }

  roleLabel(role: AccountUser['role']): string {
    return role === 'MANAGER' ? 'Manager' : 'Employé';
  }

  statusLabel(user: AccountUser): string {
    if (this.tab === 'pending') return user.firstLogin ? 'Email envoyé' : "En attente d'activation";
    if (this.tab === 'disabled') return 'Désactivé';
    return 'Actif';
  }

  firstLoginLabel(user: AccountUser): string {
    return user.firstLogin ? 'Mot de passe temporaire à changer' : 'Mot de passe personnalisé';
  }

  managerName(managerId?: number | null): string {
    if (!managerId) return 'Non renseigné';
    const all = [...this.accounts.pending, ...this.accounts.active, ...this.accounts.disabled];
    const manager = all.find((u) => u.id === managerId);
    return manager ? this.fullName(manager) : `#${managerId}`;
  }

  modalTitle(): string {
    if (!this.confirm) return '';
    return {
      create: 'Envoyer les accès ?',
      reset: 'Réinitialiser le mot de passe ?',
      deactivate: 'Suspendre ce compte ?',
      reactivate: 'Réactiver ce compte ?',
    }[this.confirm.action];
  }

  modalText(): string {
    if (!this.confirm) return '';
    const user = this.confirm.user;
    if (this.confirm.action === 'create') {
      return `Un mot de passe temporaire sera envoyé à ${user.email}. L'utilisateur devra le changer à la première connexion.`;
    }
    if (this.confirm.action === 'reset') {
      return `Un nouveau mot de passe temporaire sera envoyé par email à ${user.email}.`;
    }
    if (this.confirm.action === 'deactivate') {
      return `L'accès de ${this.fullName(user)} sera immédiatement révoqué.`;
    }
    return `L'accès de ${this.fullName(user)} sera de nouveau autorisé.`;
  }

  modalPrimaryLabel(): string {
    if (!this.confirm) return '';
    return {
      create: "Envoyer l'email",
      reset: 'Envoyer le nouveau MDP',
      deactivate: 'Suspendre',
      reactivate: 'Réactiver',
    }[this.confirm.action];
  }

  private showSuccess(action: ConfirmAction, user: AccountUser, result?: AccountResult): void {
    const email = result?.email || user.email;
    const message =
      action === 'create'
          ? `Email d'activation envoyé à ${email}.`
          : action === 'reset'
            ? `Nouveau mot de passe temporaire envoyé à ${email}.`
            : action === 'deactivate'
              ? 'Compte suspendu.'
              : 'Compte réactivé.';
    this.showToast('success', message);
  }

  private showToast(type: 'success' | 'error', message: string): void {
    this.toast = { type, message };
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.toastTimeout = setTimeout(() => {
      this.toast = null;
    }, 3000);
  }
}
