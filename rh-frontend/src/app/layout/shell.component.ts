import { Component, HostListener, OnInit } from '@angular/core';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../core/auth.service';
import { IIconComponent } from '../core/i-icon.component';
import { Role } from '../core/models';
import { environment } from '../../environments/environment';

type NavItem = { label: string; path: string; roles: Role[]; icon: string; exact?: boolean };
type NotificationItem = {
  id: number;
  titre: string;
  message: string;
  type: string;
  lu: boolean;
  createdAt: string;
};

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgFor, NgIf, NgClass, IIconComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  readonly items: NavItem[] = [
    { label: 'Tableau de bord', path: '/dashboard', roles: ['RH', 'ADMIN', 'EMPLOYEE', 'MANAGER'], icon: 'layout-dashboard', exact: true },
    { label: 'Employés', path: '/employees', roles: ['RH'], icon: 'users' },
    { label: 'Comptes', path: '/accounts', roles: ['ADMIN'], icon: 'shield' },
    { label: 'Congés', path: '/leaves', roles: ['EMPLOYEE', 'MANAGER'], icon: 'calendar', exact: true },
    { label: 'Congés', path: '/leaves/manage', roles: ['RH'], icon: 'calendar' },
    { label: 'Annonces', path: '/announcements', roles: ['RH', 'EMPLOYEE', 'MANAGER'], icon: 'megaphone' },
    { label: 'Documents', path: '/documents', roles: ['RH', 'EMPLOYEE', 'MANAGER'], icon: 'file-text' },
    { label: 'Contrats', path: '/contracts', roles: ['RH'], icon: 'file-signature' },
    { label: 'Feuille de temps', path: '/timesheet', roles: ['RH', 'EMPLOYEE', 'MANAGER'], icon: 'clock' },
    { label: 'Mes Projets', path: '/projects', roles: ['MANAGER'], icon: 'briefcase' },
    { label: 'Dépenses', path: '/expenses', roles: ['RH'], icon: 'wallet' },
    { label: 'Mes frais', path: '/my-expense-claims', roles: ['EMPLOYEE', 'MANAGER'], icon: 'receipt' },
    { label: 'Frais salariés', path: '/expense-claims', roles: ['RH'], icon: 'receipt' },
    { label: 'Paie', path: '/payroll', roles: ['RH'], icon: 'banknote' },
    { label: 'Ma paie', path: '/my-payroll', roles: ['EMPLOYEE', 'MANAGER'], icon: 'banknote' },
    { label: 'Appréciations', path: '/appraisals', roles: ['MANAGER'], icon: 'star', exact: true },
    { label: 'Mes appréciations', path: '/appraisals/me', roles: ['EMPLOYEE', 'MANAGER'], icon: 'user-check' },
    { label: 'Appréciations', path: '/appraisals/view', roles: ['RH'], icon: 'star', exact: true },
    { label: 'Messagerie', path: '/messaging', roles: ['RH', 'EMPLOYEE', 'MANAGER'], icon: 'message-square' },
    { label: 'Référentiel RH', path: '/ai-docs', roles: ['RH'], icon: 'book-open' },
    { label: 'Assistant', path: '/chatbot', roles: ['RH', 'EMPLOYEE', 'MANAGER'], icon: 'bot' },
  ];

  notifications: NotificationItem[] = [];
  notificationsOpen = false;

  constructor(readonly auth: AuthService, private readonly router: Router, private readonly http: HttpClient) { }

  ngOnInit(): void {
    this.loadNotifications();
    window.setInterval(() => this.loadNotifications(), 60000);
  }

  visible(item: NavItem): boolean {
    const role = this.auth.user?.role;
    return !!role && item.roles.includes(role);
  }

  isMessagingRoute(): boolean {
    return this.router.url.startsWith('/messaging');
  }

  isDashboardRoute(): boolean {
    return this.router.url.startsWith('/dashboard');
  }

  isChatbotRoute(): boolean {
    return this.router.url.startsWith('/chatbot');
  }

  isAiDocsRoute(): boolean {
    return this.router.url.startsWith('/ai-docs');
  }

  isEmployeesRoute(): boolean {
    return this.router.url.startsWith('/employees');
  }

  isAccountsRoute(): boolean {
    return this.router.url.startsWith('/accounts');
  }

  get unreadNotifications(): number {
    return this.notifications.filter(n => !n.lu).length;
  }

  loadNotifications(): void {
    if (!this.auth.isLoggedIn()) return;
    this.http.get<NotificationItem[]>(`${environment.apiUrl}/api/notifications/me`).subscribe({
      next: items => {
        this.notifications = items || [];
        if (this.notificationsOpen) this.markAllRead();
      },
      error: () => { },
    });
  }

  toggleNotifications(): void {
    this.notificationsOpen = !this.notificationsOpen;
    if (this.notificationsOpen) {
      this.loadNotifications();
      this.markAllRead();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.notificationsOpen) return;
    const target = event.target as HTMLElement;
    if (!target.closest('.notification-anchor')) {
      this.notificationsOpen = false;
    }
  }

  private markAllRead(): void {
    const unread = this.notifications.filter(n => !n.lu);
    unread.forEach(n => {
      n.lu = true;
      this.http.post<void>(`${environment.apiUrl}/api/notifications/${n.id}/read`, {}).subscribe({
        error: () => n.lu = false,
      });
    });
  }

  markNotificationRead(item: NotificationItem): void {
    if (item.lu) return;
    item.lu = true;
    this.http.post<void>(`${environment.apiUrl}/api/notifications/${item.id}/read`, {}).subscribe({
      error: () => item.lu = false,
    });
  }

  notificationAge(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const diff = Date.now() - date.getTime();
    const min = Math.max(1, Math.floor(diff / 60000));
    if (min < 60) return `il y a ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `il y a ${h} h`;
    return date.toLocaleDateString('fr-FR');
  }

  initials(user: any): string {
    return ((user?.prenom?.[0] || '') + (user?.nom?.[0] || '')).toUpperCase();
  }
}
