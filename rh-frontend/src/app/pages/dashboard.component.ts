import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { LowerCasePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import Chart from 'chart.js/auto';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { IIconComponent } from '../core/i-icon.component';
import { environment } from '../../environments/environment';

interface RhAlert {
  icon: string;
  label: string;
  value: number;
  tone: 'normal' | 'medium' | 'critical';
}

interface LeaveItem {
  id?: number;
  name: string;
  initials: string;
  type: string;
  datePeriode: string;
  statut: string;
  badgeClass: string;
  amount?: string;
}

interface NotificationItem {
  id: number;
  titre: string;
  message: string;
  type: string;
  lu: boolean;
  createdAt: string;
}

interface MiniKpi {
  icon: string;
  label: string;
  value: string;
  hint: string;
  tone: string;
  hasArrow?: boolean;
}

interface FinanceMonth {
  label: string;
  month: number;
  year: number;
  netPayroll: number;
  rhExpenses: number;
  reimbursedClaims: number;
  socialCharges: number;
  totalOutflow: number;
}

interface LeaveTypeCard {
  key: string;
  label: string;
  icon: string;
  tone: string;
  used: number;
  quota: number | null;
  remaining: number | null;
  pct: number;
}

interface DashboardMetric {
  icon: string;
  label: string;
  value: string;
  hint: string;
  tone: string;
  route?: string;
}

interface ProjectHoursRow {
  label: string;
  hours: number;
  pct: number;
  color: string;
}

interface SimplePersonRow {
  id?: number;
  name: string;
  initials: string;
  detail: string;
  status: string;
  badgeClass: string;
}

interface AdminMetricRow {
  label: string;
  value: number;
  pct: number;
  tone: string;
}

interface AdminHealthItem {
  label: string;
  value: number;
  status: string;
  tone: string;
}

interface AdminWatchAccount {
  initials: string;
  name: string;
  role: string;
  status: string;
  priority: string;
  detail: string;
  tone: string;
}

interface AdminDashboardSummary {
  totalComptes: number;
  comptesActifs: number;
  comptesEnAttente: number;
  comptesDesactives: number;
  sansManager: number;
  jamaisConnectes: number;
  tauxActivation: number;
  repartitionStatut: AdminMetricRow[];
  repartitionRole: AdminMetricRow[];
  repartitionDepartement: AdminMetricRow[];
  hygieneAcces: AdminHealthItem[];
  comptesASurveiller: AdminWatchAccount[];
}

interface FinanceSummary {
  month: number;
  year: number;
  netPayroll: number;
  grossPayroll: number;
  socialCharges: number;
  rhExpenses: number;
  reimbursedClaims: number;
  pendingReimbursement: number;
  totalOutflow: number;
  generatedPayslipCount: number;
  pendingReimbursementCount: number;
  monthlyOutflows: FinanceMonth[];
}

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [NgIf, NgFor, NgClass, LowerCasePipe, RouterLink, IIconComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('outflowCanvas') outflowRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('expenseDonutCanvas') expenseDonutRef?: ElementRef<HTMLCanvasElement>;

  todayStr = '';
  selectedMonth = new Date().getMonth() + 1;
  selectedYear = new Date().getFullYear();
  selectedMonthLabel = '';

  activeCount = 0;
  pendingRh = 0;
  pendingDocs = 0;
  submittedTimesheets = 0;
  pendingAppraisals = 0;
  expiringContracts = 0;
  acceptanceRate = 0;
  leaveStats = { pendingManager: 0, pendingRh: 0, approved: 0, refused: 0, inProgress: 0 };
  rhAlerts: RhAlert[] = [];
  deptRows: { label: string; value: number; pct: number }[] = [];
  leaveRows: { label: string; value: number; pct: number; color: string }[] = [];
  rhRecentLeaves: LeaveItem[] = [];
  recentRequests: LeaveItem[] = [];
  miniKpis: MiniKpi[] = [];
  finance: FinanceSummary = this.emptyFinance();
  financeLoaded = false;
  rhDataLoaded = false;

  monthPickerOpen = false;
  monthOptions: { label: string; month: number; year: number }[] = [];
  
  notifications: NotificationItem[] = [];
  dashNotificationsOpen = false;

  balance: any | null = null;
  leaveUsedPct = 0;
  employeeLeaveCards: LeaveTypeCard[] = [];
  employeeLeaveMonths: { label: string; value: number; pct: number }[] = [];
  employeeNextAbsence = 'Aucune';
  employeePendingLeaves = 0;
  employeeMetrics: DashboardMetric[] = [];
  myLeaves: LeaveItem[] = [];
  myPendingCount = 0;
  myDocRequests: any[] = [];
  myReadyDocs: any[] = [];
  myClaims: any[] = [];
  myPayslips: any[] = [];
  myAppraisals: any[] = [];
  myTimesheetStatut = '';
  myTimesheetSemaine = '';
  myTimesheetHours = 0;
  myTimesheetExpected = 35;
  myProject: string | null = null;
  announcements: any[] = [];
  empDataLoaded = false;

  managerBalance: any | null = null;
  managerLeaveUsedPct = 0;
  managerLeaveCards: LeaveTypeCard[] = [];
  managerMetrics: DashboardMetric[] = [];
  teamSize = 0;
  teamPendingLeaves: LeaveItem[] = [];
  teamPendingTimesheets = 0;
  teamPendingTimesheetsList: any[] = [];
  teamTimesheets: any[] = [];
  teamRecentLeaves: LeaveItem[] = [];
  teamUpcomingLeaves: LeaveItem[] = [];
  teamLeaveStatusRows: { label: string; value: number; pct: number; color: string }[] = [];
  teamProjectHours: ProjectHoursRow[] = [];
  teamAppraisals: SimplePersonRow[] = [];
  managerMyLeaves: any[] = [];
  absentToday = 0;
  managerAnnouncements: any[] = [];
  mgrDataLoaded = false;

  adminSummary: AdminDashboardSummary = this.emptyAdminSummary();
  adminDataLoaded = false;

  private outflowChart?: Chart<any, any, any>;
  private expenseDonutChart?: Chart<any, any, any>;

  constructor(
    readonly auth: AuthService,
    private readonly http: HttpClient,
  ) {}

  ngOnInit(): void {
    const now = new Date();
    this.selectedMonth = now.getMonth() + 1;
    this.selectedYear = now.getFullYear();
    this.selectedMonthLabel = this.monthYear(now);
    this.todayStr = now.toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    const role = this.auth.user?.role;
    if (role === 'RH') { this.loadRhDashboard(); }
    if (role === 'EMPLOYEE') { this.loadEmployeeDashboard(); }
    if (role === 'MANAGER') { this.loadManagerDashboard(); }
    if (role === 'ADMIN') { this.loadAdminDashboard(); }

    // Build 12 month options for picker
    const now2 = new Date();
    const opts: { label: string; month: number; year: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now2.getFullYear(), now2.getMonth() - i, 1);
      const lbl = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      opts.push({ label: lbl.charAt(0).toUpperCase() + lbl.slice(1), month: d.getMonth() + 1, year: d.getFullYear() });
    }
    this.monthOptions = opts;

    this.loadDashNotifications();
    window.setInterval(() => this.loadDashNotifications(), 60000);
  }

  ngAfterViewInit(): void {
    if (this.rhDataLoaded) { this.renderRhCharts(); }
  }

  ngOnDestroy(): void {
    this.outflowChart?.destroy();
    this.expenseDonutChart?.destroy();
  }

  selectMonth(m: { label: string; month: number; year: number }): void {
    this.selectedMonth = m.month;
    this.selectedYear = m.year;
    this.selectedMonthLabel = m.label;
    this.monthPickerOpen = false;
    this.rhDataLoaded = false;
    this.outflowChart?.destroy();
    this.expenseDonutChart?.destroy();
    this.loadRhDashboard();
  }

  get dashUnreadCount(): number {
    return this.notifications.filter(n => !n.lu).length;
  }

  loadDashNotifications(): void {
    if (!this.auth.isLoggedIn()) return;
    this.http.get<NotificationItem[]>(`${environment.apiUrl}/api/notifications/me`).subscribe({
      next: items => {
        this.notifications = items || [];
        if (this.dashNotificationsOpen) this.markAllDashRead();
      },
      error: () => { },
    });
  }

  toggleDashNotif(): void {
    this.dashNotificationsOpen = !this.dashNotificationsOpen;
    if (this.dashNotificationsOpen) {
      this.loadDashNotifications();
      this.markAllDashRead();
    }
  }

  private markAllDashRead(): void {
    const unread = this.notifications.filter(n => !n.lu);
    unread.forEach(n => {
      n.lu = true;
      this.http.post<void>(`${environment.apiUrl}/api/notifications/${n.id}/read`, {}).subscribe({
        error: () => n.lu = false,
      });
    });
  }

  markDashNotificationRead(item: NotificationItem): void {
    if (item.lu) return;
    item.lu = true;
    this.http.post<void>(`${environment.apiUrl}/api/notifications/${item.id}/read`, {}).subscribe({
      error: () => item.lu = false,
    });
  }

  dashNotificationAge(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const diff = Date.now() - date.getTime();
    const min = Math.max(1, Math.floor(diff / 60000));
    if (min < 60) return `il y a ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `il y a ${h} h`;
    return date.toLocaleDateString('fr-FR');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.monthPickerOpen && !target.closest('.rh-db-month-picker-wrap')) {
      this.monthPickerOpen = false;
    }
    if (this.dashNotificationsOpen && !target.closest('.rh-db-notif-wrap')) {
      this.dashNotificationsOpen = false;
    }
  }

  fileUrl(path: string): string {
    return `${environment.apiUrl}${path}`;
  }

  downloadUrl(path: string | null | undefined): string | null {
    return path ? this.fileUrl(path) : null;
  }

  docLabel(doc: any): string {
    const labels: Record<string, string> = {
      ATTESTATION_TRAVAIL: 'Attestation de travail',
      BULLETIN_PAIE: 'Bulletin de paie',
      CONTRAT: 'Contrat',
      RIB: 'RIB',
    };
    return labels[doc?.typeDoc] || doc?.typeDoc || doc?.titre || 'Document';
  }

  claimTitle(claim: any): string {
    return claim?.titre || claim?.objet || claim?.description || claim?.categorie || 'Note de frais';
  }

  shortDate(value: string | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', '');
  }

  monthName(month: number, year: number): string {
    const date = new Date(year, Math.max(0, month - 1), 1);
    const label = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return label.substring(0, 1).toUpperCase() + label.substring(1);
  }

  money(value: number | null | undefined): string {
    const safeValue = Number(value || 0);
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(safeValue);
  }

  compactMoney(value: number | null | undefined): string {
    const safeValue = Number(value || 0);
    if (safeValue >= 1000000) return `${this.money(Math.round(safeValue / 1000))}k`;
    if (safeValue >= 1000) return `${this.money(Math.round(safeValue / 1000))}k`;
    return this.money(safeValue);
  }

  ratio(value: number, total: number): number {
    if (!total) return 0;
    return Math.round((value / total) * 100);
  }

  miniLinePoints(index: number): string {
    const lines = [
      '0,34 24,28 48,33 72,24 96,27 120,20 144,22 168,16',
      '0,36 24,30 48,34 72,26 96,29 120,21 144,24 168,18',
      '0,35 24,29 48,33 72,25 96,28 120,20 144,22 168,16',
      '0,34 24,28 48,32 72,24 96,27 120,19 144,21 168,15',
    ];
    return lines[index] || lines[0];
  }

  private loadRhDashboard(): void {
    forkJoin({
      finance: this.http.get<FinanceSummary>(
        `${environment.apiUrl}/api/payroll/dashboard/rh?month=${this.selectedMonth}&year=${this.selectedYear}`,
      ).pipe(catchError(() => of(this.emptyFinance()))),
      leaves: this.http.get<Record<string, number>>(`${environment.apiUrl}/api/leaves/rh/dashboard`).pipe(catchError(() => of(null))),
      users: this.http.get<any[]>(`${environment.apiUrl}/api/users`).pipe(catchError(() => of([]))),
      docRequests: this.http.get<any[]>(`${environment.apiUrl}/api/documents/requests/all`).pipe(catchError(() => of([]))),
      timesheets: this.http.get<any[]>(`${environment.apiUrl}/api/timesheets/rh/all`).pipe(catchError(() => of([]))),
      allLeaves: this.http.get<any[]>(`${environment.apiUrl}/api/leaves/rh/search`).pipe(catchError(() => of([]))),
      contracts: this.http.get<any[]>(`${environment.apiUrl}/api/contracts`).pipe(catchError(() => of([]))),
      appraisals: this.http.get<any[]>(`${environment.apiUrl}/api/appraisals`).pipe(catchError(() => of([]))),
      claims: this.http.get<any[]>(`${environment.apiUrl}/api/expense-claims/rh`).pipe(catchError(() => of([]))),
    }).subscribe((data) => {
      this.finance = this.normalizeFinance(data.finance);
      this.financeLoaded = true;

      const activeUsers = data.users.filter((u: any) => u.actif && u.role !== 'ADMIN' && u.role !== 'RH');
      this.activeCount = activeUsers.length;
      this.pendingRh = data.leaves?.['pendingRh'] ?? 0;
      this.pendingDocs = data.docRequests.filter((d: any) => d.statut === 'EN_ATTENTE').length;
      this.submittedTimesheets = data.timesheets.filter((t: any) => t.statut === 'SOUMIS').length;
      this.pendingAppraisals = data.appraisals.filter((a: any) => ['BROUILLON', 'SOUMIS', 'PRISE_CONNAISSANCE'].includes(a.statut)).length;
      this.expiringContracts = this.countExpiringContracts(data.contracts);

      this.leaveStats = {
        pendingManager: data.leaves?.['pendingManager'] ?? 0,
        pendingRh: data.leaves?.['pendingRh'] ?? 0,
        approved: data.leaves?.['approved'] ?? 0,
        refused: data.leaves?.['refused'] ?? 0,
        inProgress: data.allLeaves.filter((l: any) => l.statut === 'APPROUVE' && this.isTodayInside(l.dateDebut, l.dateFin)).length,
      };
      const leaveTotal = this.leaveStats.pendingManager + this.leaveStats.pendingRh + this.leaveStats.approved + this.leaveStats.refused + this.leaveStats.inProgress;
      this.acceptanceRate = this.ratio(this.leaveStats.approved, this.leaveStats.approved + this.leaveStats.refused);
      this.leaveRows = [
        { label: 'Approuvés', value: this.leaveStats.approved, pct: this.ratio(this.leaveStats.approved, leaveTotal), color: '#10865f' },
        { label: 'En attente', value: this.leaveStats.pendingManager + this.leaveStats.pendingRh, pct: this.ratio(this.leaveStats.pendingManager + this.leaveStats.pendingRh, leaveTotal), color: '#d97706' },
        { label: 'Refusés', value: this.leaveStats.refused, pct: this.ratio(this.leaveStats.refused, leaveTotal), color: '#dc2626' },
        { label: 'En cours', value: this.leaveStats.inProgress, pct: this.ratio(this.leaveStats.inProgress, leaveTotal), color: '#1d4ed8' },
      ];

      this.deptRows = this.buildDeptRows(activeUsers);
      this.rhAlerts = this.buildAlerts();
      this.miniKpis = this.buildMiniKpis();
      this.rhRecentLeaves = this.buildRecentLeaves(data.allLeaves, data.users);
      this.recentRequests = this.buildRecentRequests(data.allLeaves, data.docRequests, data.timesheets, data.claims, data.users);

      this.rhDataLoaded = true;
      setTimeout(() => this.renderRhCharts(), 0);
    });
  }

  private buildMiniKpis(): MiniKpi[] {
    return [
      { icon: 'users', label: 'Effectif actif', value: String(this.activeCount), hint: '+6 vs Mai', tone: 'blue', hasArrow: true },
      { icon: 'calendar', label: 'Congés en attente', value: String(this.pendingRh), hint: '+4 vs Mai', tone: 'amber', hasArrow: true },
      { icon: 'file-text', label: 'Documents à traiter', value: String(this.pendingDocs), hint: '+7 vs Mai', tone: 'blue', hasArrow: true },
      { icon: 'clock', label: 'Feuilles de temps', value: String(this.submittedTimesheets), hint: 'à valider', tone: 'green', hasArrow: false },
      { icon: 'star', label: 'Évaluations en attente', value: String(this.pendingAppraisals), hint: '+3 vs Mai', tone: 'amber', hasArrow: true },
      { icon: 'file-text', label: 'Bulletins de paie', value: String(this.finance.generatedPayslipCount), hint: 'générés', tone: 'blue', hasArrow: false },
    ];
  }

  private buildAlerts(): RhAlert[] {
    const alerts: RhAlert[] = [
      { icon: 'calendar', label: 'Congés en attente RH', value: this.pendingRh, tone: 'medium' },
      { icon: 'file-text', label: 'Documents à traiter', value: this.pendingDocs, tone: 'normal' },
      { icon: 'clock', label: 'Feuilles de temps à valider', value: this.submittedTimesheets, tone: 'critical' },
      { icon: 'briefcase', label: 'CDD arrivant à échéance', value: this.expiringContracts, tone: 'medium' },
      { icon: 'receipt', label: 'Frais à rembourser', value: this.finance.pendingReimbursementCount, tone: 'normal' },
    ];
    return alerts.filter((alert) => alert.value > 0);
  }

  private buildDeptRows(users: any[]): { label: string; value: number; pct: number }[] {
    const deptMap = new Map<string, number>();
    users.forEach((u: any) => {
      const dept = u.departement || 'Non défini';
      deptMap.set(dept, (deptMap.get(dept) || 0) + 1);
    });
    const rows = Array.from(deptMap.entries())
      .map(([label, value]) => ({ label, value, pct: 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    const max = Math.max(...rows.map((r) => r.value), 1);
    return rows.map((r) => ({ ...r, pct: Math.round((r.value / max) * 100) }));
  }

  private buildRecentLeaves(leaves: any[], users: any[]): LeaveItem[] {
    return leaves
      .sort((a: any, b: any) => (b.createdAt || b.dateDebut || '').localeCompare(a.createdAt || a.dateDebut || ''))
      .slice(0, 5)
      .map((l: any) => {
        const user = users.find((u: any) => u.id === l.employeeId);
        const name = user ? `${user.prenom} ${user.nom}` : `Salarié #${l.employeeId}`;
        return {
          name,
          initials: this.initials(name),
          type: l.typeConge || 'Congé',
          datePeriode: this.formatPeriode(l.dateDebut, l.dateFin),
          statut: this.readableStatus(l.statut),
          badgeClass: this.statusBadge(l.statut),
        };
      });
  }

  private buildRecentRequests(leaves: any[], docs: any[], timesheets: any[], claims: any[], users: any[]): LeaveItem[] {
    const userName = (employeeId: number) => {
      const user = users.find((u: any) => u.id === employeeId);
      return user ? `${user.prenom} ${user.nom}` : `Salarié #${employeeId}`;
    };
    const rows: LeaveItem[] = [
      ...leaves.slice(0, 2).map((l: any) => {
        const name = userName(l.employeeId);
        return {
          name,
          initials: this.initials(name),
          type: 'Congé',
          datePeriode: this.formatPeriode(l.dateDebut, l.dateFin),
          statut: this.readableStatus(l.statut),
          badgeClass: this.statusBadge(l.statut),
        };
      }),
      ...claims.slice(0, 2).map((c: any) => ({
        name: c.employeeLabel || userName(c.employeeId),
        initials: c.employeeInitials || this.initials(c.employeeLabel || ''),
        type: 'Note de frais',
        datePeriode: this.money(c.montant) + ' MAD',
        statut: this.readableStatus(c.status),
        badgeClass: this.statusBadge(c.status),
      })),
      ...docs.slice(0, 1).map((d: any) => ({
        name: userName(d.employeeId),
        initials: this.initials(userName(d.employeeId)),
        type: 'Document',
        datePeriode: d.typeDoc || d.type || 'Demande',
        statut: this.readableStatus(d.statut),
        badgeClass: this.statusBadge(d.statut),
      })),
      ...timesheets.slice(0, 1).map((t: any) => ({
        name: userName(t.employeeId),
        initials: this.initials(userName(t.employeeId)),
        type: 'Feuille de temps',
        datePeriode: t.semaineDebut ? this.formatSemaine(t.semaineDebut) : 'Semaine en cours',
        statut: this.readableStatus(t.statut),
        badgeClass: this.statusBadge(t.statut),
      })),
    ];
    return rows.slice(0, 5);
  }

  private countExpiringContracts(contracts: any[]): number {
    const now = new Date();
    const limit = new Date();
    limit.setDate(limit.getDate() + 30);
    return contracts.filter((c: any) => {
      if (c.type !== 'CDD' || c.status !== 'GENERE' || !c.endDate) return false;
      const end = new Date(c.endDate + 'T00:00:00');
      return end >= now && end <= limit;
    }).length;
  }

  private isTodayInside(start: string, end: string): boolean {
    if (!start) return false;
    const today = new Date().toISOString().split('T')[0];
    return start <= today && (!end || end >= today);
  }

  private normalizeFinance(finance: FinanceSummary | null): FinanceSummary {
    return { ...this.emptyFinance(), ...(finance || {}), monthlyOutflows: finance?.monthlyOutflows || this.emptyFinance().monthlyOutflows };
  }

  private emptyFinance(): FinanceSummary {
    const now = new Date(this.selectedYear, this.selectedMonth - 1, 1);
    const months: FinanceMonth[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        label: date.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''),
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        netPayroll: 0,
        rhExpenses: 0,
        reimbursedClaims: 0,
        socialCharges: 0,
        totalOutflow: 0,
      });
    }
    return {
      month: this.selectedMonth,
      year: this.selectedYear,
      netPayroll: 0,
      grossPayroll: 0,
      socialCharges: 0,
      rhExpenses: 0,
      reimbursedClaims: 0,
      pendingReimbursement: 0,
      totalOutflow: 0,
      generatedPayslipCount: 0,
      pendingReimbursementCount: 0,
      monthlyOutflows: months,
    };
  }

  private loadEmployeeDashboard(): void {
    const monday = this.getCurrentMonday();
    forkJoin({
      balance: this.http.get<any>(`${environment.apiUrl}/api/leaves/balances/me`).pipe(catchError(() => of(null))),
      myLeaves: this.http.get<any[]>(`${environment.apiUrl}/api/leaves/my`).pipe(catchError(() => of([]))),
      announcements: this.http.get<any[]>(`${environment.apiUrl}/api/documents/announcements/latest`).pipe(catchError(() => of([]))),
      myDocRequests: this.http.get<any[]>(`${environment.apiUrl}/api/documents/requests/my`).pipe(catchError(() => of([]))),
      timesheet: this.http.get<any>(`${environment.apiUrl}/api/timesheets/week/${monday}`).pipe(catchError(() => of(null))),
      project: this.http.get<any>(`${environment.apiUrl}/api/projects/assigned`).pipe(catchError(() => of(null))),
      claims: this.http.get<any[]>(`${environment.apiUrl}/api/expense-claims/my`).pipe(catchError(() => of([]))),
      payslips: this.http.get<any[]>(`${environment.apiUrl}/api/payroll/my-payslips`).pipe(catchError(() => of([]))),
      appraisals: this.http.get<any[]>(`${environment.apiUrl}/api/appraisals/me`).pipe(catchError(() => of([]))),
    }).subscribe((data) => {
      this.balance = data.balance;
      if (data.balance) {
        const s = data.balance.soldeAnnuel || 26;
        const u = data.balance.joursUtilises || 0;
        this.leaveUsedPct = Math.min(100, Math.round((u / s) * 100));
      }
      this.employeeLeaveCards = this.buildLeaveTypeCards(data.myLeaves, data.balance);
      this.employeeLeaveMonths = this.buildLeaveMonthBars(data.myLeaves);
      this.employeeNextAbsence = this.nextAbsenceLabel(data.myLeaves);
      this.employeePendingLeaves = data.myLeaves.filter((l: any) => l.statut?.includes('ATTENTE')).length;
      this.myPendingCount = this.employeePendingLeaves;
      this.myLeaves = data.myLeaves.slice(0, 5).map((l: any) => ({
        name: '',
        initials: '',
        type: this.leaveTypeLabel(l.typeConge),
        datePeriode: this.formatPeriode(l.dateDebut, l.dateFin),
        statut: this.readableStatus(l.statut),
        badgeClass: this.statusBadge(l.statut),
      }));
      this.announcements = data.announcements || [];
      this.myDocRequests = (data.myDocRequests || []).slice(0, 5);
      this.myReadyDocs = (data.myDocRequests || []).filter((d: any) => d.statut === 'PRET').slice(0, 4);
      this.myClaims = (data.claims || []).slice(0, 3);
      this.myPayslips = (data.payslips || []).slice(0, 3);
      this.myAppraisals = data.appraisals || [];
      this.myTimesheetStatut = data.timesheet?.statut || 'BROUILLON';
      this.myTimesheetSemaine = data.timesheet?.semaineDebut ? this.formatSemaine(data.timesheet.semaineDebut) : '';
      this.myTimesheetHours = Number(data.timesheet?.totalHeures || 0);
      this.myTimesheetExpected = Number(data.timesheet?.expectedHours || 35);
      this.myProject = data.project?.nom || null;
      this.employeeMetrics = this.buildEmployeeMetrics();
      this.empDataLoaded = true;
    });
  }

  private loadManagerDashboard(): void {
    const monday = this.getCurrentMonday();
    forkJoin({
      pendingLeaves: this.http.get<any[]>(`${environment.apiUrl}/api/leaves/manager/pending`).pipe(catchError(() => of([]))),
      teamLeaves: this.http.get<any[]>(`${environment.apiUrl}/api/leaves/manager/search`).pipe(catchError(() => of([]))),
      pendingTimesheets: this.http.get<any[]>(`${environment.apiUrl}/api/timesheets/manager/pending`).pipe(catchError(() => of([]))),
      announcements: this.http.get<any[]>(`${environment.apiUrl}/api/documents/announcements/latest`).pipe(catchError(() => of([]))),
      balance: this.http.get<any>(`${environment.apiUrl}/api/leaves/balances/me`).pipe(catchError(() => of(null))),
      team: this.http.get<any[]>(`${environment.apiUrl}/api/users/team`).pipe(catchError(() => of([]))),
      myLeaves: this.http.get<any[]>(`${environment.apiUrl}/api/leaves/my`).pipe(catchError(() => of([]))),
      timesheet: this.http.get<any>(`${environment.apiUrl}/api/timesheets/week/${monday}`).pipe(catchError(() => of(null))),
      project: this.http.get<any>(`${environment.apiUrl}/api/projects/assigned`).pipe(catchError(() => of(null))),
      appraisals: this.http.get<any[]>(`${environment.apiUrl}/api/appraisals/my-team`).pipe(catchError(() => of([]))),
    }).subscribe((data) => {
      this.managerBalance = data.balance;
      if (data.balance) {
        const s = data.balance.soldeAnnuel || 26;
        const u = data.balance.joursUtilises || 0;
        this.managerLeaveUsedPct = Math.min(100, Math.round((u / s) * 100));
      }
      this.managerLeaveCards = this.buildLeaveTypeCards(data.myLeaves, data.balance);
      this.managerMyLeaves = data.myLeaves || [];
      this.managerAnnouncements = data.announcements || [];
      this.myTimesheetStatut = data.timesheet?.statut || 'BROUILLON';
      this.myTimesheetSemaine = data.timesheet?.semaineDebut ? this.formatSemaine(data.timesheet.semaineDebut) : '';
      this.myTimesheetHours = Number(data.timesheet?.totalHeures || 0);
      this.myTimesheetExpected = Number(data.timesheet?.expectedHours || 35);
      this.myProject = data.project?.nom || null;
      this.myPendingCount = data.myLeaves.filter((l: any) => l.statut?.includes('ATTENTE')).length;
      this.myLeaves = data.myLeaves.slice(0, 3).map((l: any) => ({
        name: '',
        initials: '',
        type: this.leaveTypeLabel(l.typeConge),
        datePeriode: this.formatPeriode(l.dateDebut, l.dateFin),
        statut: this.readableStatus(l.statut),
        badgeClass: this.statusBadge(l.statut),
      }));
      this.teamSize = data.team.filter((u: any) => u.actif).length;
      const filteredTimesheets = data.pendingTimesheets.filter((t: any) => t.statut === 'SOUMIS');
      this.teamPendingTimesheets = filteredTimesheets.length;
      this.teamPendingTimesheetsList = filteredTimesheets;
      this.teamTimesheets = data.pendingTimesheets || [];
      const usersMap = new Map<number, any>();
      data.team.forEach((u: any) => usersMap.set(u.id, u));
      const pendingLeaves = data.pendingLeaves.filter((l: any) => l.statut === 'EN_ATTENTE_MANAGER');
      this.teamPendingLeaves = pendingLeaves.slice(0, 5).map((l: any) => this.teamLeaveItem(l, usersMap));
      this.teamRecentLeaves = data.teamLeaves.slice(0, 5).map((l: any) => this.teamLeaveItem(l, usersMap));
      this.teamUpcomingLeaves = data.teamLeaves
        .filter((l: any) => l.statut === 'APPROUVE' && l.dateFin >= new Date().toISOString().split('T')[0])
        .slice(0, 5)
        .map((l: any) => this.teamLeaveItem({ ...l, statut: 'APPROUVE' }, usersMap));
      this.absentToday = data.teamLeaves.filter((l: any) => l.statut === 'APPROUVE' && this.isTodayInside(l.dateDebut, l.dateFin)).length;
      this.teamLeaveStatusRows = this.buildTeamLeaveStatusRows(data.teamLeaves);
      this.teamProjectHours = this.buildProjectHours(data.pendingTimesheets);
      const pendingAppraisals = (data.appraisals || []).filter((a: any) => a.statut === 'BROUILLON' || a.statut === 'SOUMIS');
      this.teamAppraisals = pendingAppraisals.slice(0, 4).map((a: any) => ({
        id: a.id,
        name: a.employeeName || `Salarié #${a.employeeId}`,
        initials: this.initials(a.employeeName || ''),
        detail: a.periode || 'Évaluation',
        status: this.readableAppraisalStatus(a.statut),
        badgeClass: this.appraisalBadge(a.statut),
      }));
      this.managerMetrics = this.buildManagerMetrics();
      this.mgrDataLoaded = true;
    });
  }

  private loadAdminDashboard(): void {
    this.adminDataLoaded = false;
    this.http.get<AdminDashboardSummary>(`${environment.apiUrl}/api/users/admin/dashboard-summary`)
      .pipe(catchError(() => of(this.emptyAdminSummary())))
      .subscribe((summary) => {
        this.adminSummary = summary || this.emptyAdminSummary();
        this.adminDataLoaded = true;
      });
  }

  private emptyAdminSummary(): AdminDashboardSummary {
    return {
      totalComptes: 0,
      comptesActifs: 0,
      comptesEnAttente: 0,
      comptesDesactives: 0,
      sansManager: 0,
      jamaisConnectes: 0,
      tauxActivation: 0,
      repartitionStatut: [],
      repartitionRole: [],
      repartitionDepartement: [],
      hygieneAcces: [],
      comptesASurveiller: [],
    };
  }

  private buildEmployeeMetrics(): DashboardMetric[] {
    const readyDocs = this.myReadyDocs.length;
    const pendingDocs = this.myDocRequests.filter((d: any) => d.statut === 'EN_ATTENTE').length;
    const pendingClaims = this.myClaims.filter((c: any) => ['SOUMIS', 'APPROUVE'].includes(c.status)).length;
    const latestPayslip = this.myPayslips[0];
    return [
      { icon: 'file-text', label: 'Demandes en attente', value: String(this.myPendingCount + pendingDocs), hint: 'à traiter', tone: 'amber', route: '/leaves' },
      { icon: 'clock', label: 'Feuille de temps', value: `${this.roundHours(this.myTimesheetHours)}h / ${this.myTimesheetExpected}h`, hint: 'cette semaine', tone: 'blue', route: '/timesheet' },
      { icon: 'folder-kanban', label: 'Projet assigné', value: this.myProject || 'Aucun', hint: this.myProject ? 'en cours' : 'non assigné', tone: 'cyan', route: '/projects' },
      { icon: 'wallet', label: 'Dernier bulletin', value: this.payslipLabel(latestPayslip), hint: latestPayslip ? 'disponible' : 'non disponible', tone: 'green', route: '/my-payroll' },
      { icon: 'receipt', label: 'Notes de frais', value: String(pendingClaims), hint: pendingClaims ? 'en attente' : 'à jour', tone: 'amber', route: '/my-expense-claims' },
      { icon: 'download', label: 'Documents prêts', value: String(readyDocs), hint: 'à télécharger', tone: 'blue', route: '/documents' },
    ];
  }

  private buildManagerMetrics(): DashboardMetric[] {
    const pendingAppraisals = this.teamAppraisals.filter((a) => a.status !== 'Validée RH').length;
    return [
      { icon: 'users', label: "Membres équipe", value: String(this.teamSize), hint: 'actifs', tone: 'blue' },
      { icon: 'calendar', label: 'Congés à valider', value: String(this.teamPendingLeaves.length), hint: 'urgent', tone: 'amber', route: '/leaves' },
      { icon: 'clock', label: 'Feuilles de temps à valider', value: String(this.teamPendingTimesheets), hint: 'soumises', tone: 'blue', route: '/timesheet' },
      { icon: 'star', label: 'Évaluations à réaliser', value: String(pendingAppraisals), hint: 'en cours', tone: 'cyan', route: '/appraisals' },
      { icon: 'calendar', label: 'Absences à venir', value: String(this.teamUpcomingLeaves.length), hint: '30 jours', tone: 'green', route: '/leaves' },
      { icon: 'user', label: "Absents aujourd'hui", value: String(this.absentToday), hint: `sur ${this.teamSize}`, tone: 'amber', route: '/leaves' },
    ];
  }

  private buildLeaveTypeCards(leaves: any[], balance: any | null): LeaveTypeCard[] {
    const configs = [
      { key: 'ANNUEL', label: 'Congé annuel', quota: Number(balance?.soldeAnnuel || 0) || null, icon: 'sun', tone: 'blue' },
      { key: 'MALADIE', label: 'Congé maladie', quota: null, icon: 'heart-pulse', tone: 'cyan' },
      { key: 'MATERNITE', label: 'Maternité', quota: 98, icon: 'baby', tone: 'pink' },
      { key: 'PATERNITE_NAISSANCE', label: 'Paternité / naissance', quota: 3, icon: 'user-plus', tone: 'green' },
      { key: 'MARIAGE_SALARIE', label: 'Mariage salarié', quota: 4, icon: 'heart', tone: 'red' },
      { key: 'MARIAGE_ENFANT', label: 'Mariage enfant', quota: 2, icon: 'users', tone: 'violet' },
      { key: 'DECES', label: 'Décès', quota: 3, icon: 'skull', tone: 'slate' },
      { key: 'SANS_SOLDE', label: 'Sans solde', quota: null, icon: 'minus-circle', tone: 'slate' },
    ];
    return configs.map((cfg) => {
      const aliases = cfg.key === 'PATERNITE_NAISSANCE' ? ['PATERNITE_NAISSANCE', 'PATERNITE'] : [cfg.key];
      const used = this.sumLeaveDays(leaves.filter((l: any) => l.statut === 'APPROUVE' && aliases.includes(l.typeConge)));
      const quota = cfg.key === 'ANNUEL' ? Number(balance?.soldeAnnuel || cfg.quota || 0) || null : cfg.quota;
      const remaining = quota == null ? null : Math.max(0, quota - used);
      return { ...cfg, used, quota, remaining, pct: quota ? this.ratio(used, quota) : Math.min(100, used * 8) };
    });
  }

  private buildLeaveMonthBars(leaves: any[]): { label: string; value: number; pct: number }[] {
    const labels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'];
    const values = labels.map((_, index) => this.sumLeaveDays(leaves.filter((l: any) => {
      if (l.statut !== 'APPROUVE' || !l.dateDebut) return false;
      const date = new Date(l.dateDebut + 'T00:00:00');
      return date.getFullYear() === this.selectedYear && date.getMonth() === index;
    })));
    const max = Math.max(...values, 1);
    return labels.map((label, index) => ({ label, value: values[index], pct: Math.max(8, Math.round((values[index] / max) * 100)) }));
  }

  private buildTeamLeaveStatusRows(leaves: any[]): { label: string; value: number; pct: number; color: string }[] {
    const statusCounts = leaves.reduce((acc, curr) => {
      const s = curr.statut || 'INCONNU';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const total = leaves.length || 1;
    return [
      { label: 'Approuvés', value: statusCounts['APPROUVE'] || 0, pct: this.ratio(statusCounts['APPROUVE'] || 0, total), color: '#10b981' },
      { label: 'En attente', value: (statusCounts['ATTENTE_MANAGER'] || 0) + (statusCounts['ATTENTE_RH'] || 0), pct: this.ratio((statusCounts['ATTENTE_MANAGER'] || 0) + (statusCounts['ATTENTE_RH'] || 0), total), color: '#f59e0b' },
      { label: 'Refusés', value: statusCounts['REFUSE'] || 0, pct: this.ratio(statusCounts['REFUSE'] || 0, total), color: '#ef4444' },
      { label: 'En cours', value: leaves.filter(l => l.statut === 'APPROUVE' && this.isTodayInside(l.dateDebut, l.dateFin)).length, pct: this.ratio(leaves.filter(l => l.statut === 'APPROUVE' && this.isTodayInside(l.dateDebut, l.dateFin)).length, total), color: '#3b82f6' }
    ];
  }

  get teamLeaveDonutGradient(): string {
    const rows = this.teamLeaveStatusRows;
    if (!rows.length) return 'conic-gradient(#e2e8f0 0 100%)';
    let grad = 'conic-gradient(';
    let currentPct = 0;
    const parts = rows.map(r => {
      if (r.pct === 0) return null;
      const start = currentPct;
      currentPct += r.pct;
      return `${r.color} ${start}% ${currentPct}%`;
    }).filter(Boolean);
    if (parts.length === 0) return 'conic-gradient(#e2e8f0 0 100%)';
    grad += parts.join(', ') + ')';
    return grad;
  }

  private buildProjectHours(timesheets: any[]): ProjectHoursRow[] {
    const colors = ['#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6'];
    const map = new Map<string, number>();
    timesheets.forEach((t: any) => (t.entries || []).forEach((entry: any) => {
      const label = entry.projectName || 'Sans projet';
      map.set(label, (map.get(label) || 0) + Number(entry.nbHeures || 0));
    }));
    const rows = Array.from(map.entries()).map(([label, hours]) => ({ label, hours }));
    const max = Math.max(...rows.map((r) => r.hours), 1);
    return rows.sort((a, b) => b.hours - a.hours).slice(0, 5).map((row, index) => ({
      ...row,
      pct: Math.round((row.hours / max) * 100),
      color: colors[index] || '#2563eb',
    }));
  }

  private sumLeaveDays(leaves: any[]): number {
    return leaves.reduce((sum, l: any) => sum + Number(l.nbJours || l.joursCalendaires || 0), 0);
  }

  private nextAbsenceLabel(leaves: any[]): string {
    const today = new Date().toISOString().split('T')[0];
    const next = leaves
      .filter((l: any) => l.statut === 'APPROUVE' && l.dateDebut >= today)
      .sort((a: any, b: any) => a.dateDebut.localeCompare(b.dateDebut))[0];
    if (!next) return 'Aucune';
    return this.formatPeriode(next.dateDebut, next.dateFin);
  }

  leaveTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      ANNUEL: 'Congé annuel',
      MALADIE: 'Congé maladie',
      MATERNITE: 'Maternité',
      PATERNITE: 'Paternité / naissance',
      PATERNITE_NAISSANCE: 'Paternité / naissance',
      MARIAGE_SALARIE: 'Mariage salarié',
      MARIAGE_ENFANT: 'Mariage enfant',
      DECES: 'Décès',
      SANS_SOLDE: 'Sans solde',
    };
    return labels[type] || type || 'Congé';
  }

  private readableAppraisalStatus(statut: string): string {
    const map: Record<string, string> = {
      BROUILLON: 'Brouillon',
      SOUMIS: 'Soumise',
      PRISE_CONNAISSANCE: 'Prise de connaissance',
      VALIDEE_RH: 'Validée RH',
    };
    return map[statut] || statut || 'Brouillon';
  }

  private appraisalBadge(statut: string): string {
    if (statut === 'VALIDEE_RH') return 'rh-db-badge-approved';
    if (statut === 'PRISE_CONNAISSANCE') return 'rh-db-badge-info';
    if (statut === 'SOUMIS') return 'rh-db-badge-pending';
    return 'rh-db-badge-default';
  }

  roundHours(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  private payslipLabel(payslip: any): string {
    if (!payslip) return 'Aucun';
    const month = payslip.month || payslip.mois;
    const year = payslip.year || payslip.annee;
    if (month && year) return this.monthName(Number(month), Number(year));
    return payslip.periode || 'Disponible';
  }

  private teamLeaveItem(l: any, usersMap: Map<number, any>): LeaveItem {
    const user = usersMap.get(l.employeeId);
    const name = user ? `${user.prenom} ${user.nom}` : `Salarié #${l.employeeId}`;
    return {
      id: l.id,
      name,
      initials: this.initials(name),
      type: l.typeConge,
      datePeriode: this.formatPeriode(l.dateDebut, l.dateFin),
      statut: this.readableStatus(l.statut),
      badgeClass: this.statusBadge(l.statut),
    };
  }

  private renderRhCharts(): void {
    this.renderOutflowChart();
    this.renderExpenseDonut();
  }

  private renderOutflowChart(): void {
    const canvas = this.outflowRef?.nativeElement;
    if (!canvas) return;
    this.outflowChart?.destroy();
    const months = this.finance.monthlyOutflows || [];
    this.outflowChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: months.map((m) => m.label),
        datasets: [
          this.lineDataset('Salaires nets', months.map((m) => m.netPayroll), '#2448c6', 'rgba(36,72,198,.08)'),
          this.lineDataset('Dépenses RH', months.map((m) => m.rhExpenses), '#0ea5e9', 'rgba(14,165,233,.08)'),
          this.lineDataset('Frais remboursés', months.map((m) => m.reimbursedClaims), '#10b981', 'rgba(16,185,129,.10)'),
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${this.money(ctx.parsed.y)} MAD` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11, weight: 400 } } },
          y: { border: { display: false }, grid: { color: '#e6edf7', borderDash: [4, 4] }, ticks: { display: false } },
        },
      },
    } as any);
  }

  private renderExpenseDonut(): void {
    const canvas = this.expenseDonutRef?.nativeElement;
    if (!canvas) return;
    this.expenseDonutChart?.destroy();
    this.expenseDonutChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Salaires nets', 'Dépenses RH', 'Frais remboursés'],
        datasets: [{
          data: [this.finance.netPayroll, this.finance.rhExpenses, this.finance.reimbursedClaims],
          backgroundColor: ['#2448c6', '#0ea5e9', '#10b981'],
          borderColor: '#ffffff',
          borderWidth: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => `${ctx.label}: ${this.money(ctx.parsed)} MAD` } } },
      },
    } as any);
  }

  private lineDataset(label: string, data: number[], borderColor: string, backgroundColor: string): any {
    return {
      label,
      data,
      borderColor,
      backgroundColor,
      borderWidth: 3,
      pointRadius: 4,
      pointHoverRadius: 5,
      pointBackgroundColor: '#ffffff',
      pointBorderColor: borderColor,
      pointBorderWidth: 2,
      tension: 0.35,
      fill: true,
    };
  }

  statusBadge(statut: string): string {
    if (statut === 'APPROUVE' || statut === 'VALIDE' || statut === 'VALIDEE_RH' || statut === 'REMBOURSE') return 'rh-db-badge-approved';
    if (statut?.includes('ATTENTE') || statut === 'SOUMIS') return 'rh-db-badge-pending';
    if (statut === 'REFUSE' || statut === 'REJETE') return 'rh-db-badge-refused';
    return 'rh-db-badge-default';
  }

  readableStatus(statut: string): string {
    const map: Record<string, string> = {
      EN_ATTENTE: 'En attente',
      ATTENTE_RH: 'En attente',
      ATTENTE_MANAGER: 'En attente',
      SOUMIS: 'En attente',
      APPROUVE: 'Approuvé',
      VALIDE: 'Validé',
      VALIDEE_RH: 'Validé',
      REFUSE: 'Refusé',
      REJETE: 'Rejeté',
      REMBOURSE: 'Remboursé',
      BROUILLON: 'Brouillon',
    };
    return map[statut] || statut || 'En attente';
  }

  private formatPeriode(dateDebut: string, dateFin: string): string {
    if (!dateDebut) return '';
    const fmt = (d: string) => {
      const dt = new Date(d + 'T00:00:00');
      return dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', '');
    };
    if (!dateFin || dateDebut === dateFin) return fmt(dateDebut);
    return `${fmt(dateDebut)} - ${fmt(dateFin)}`;
  }

  formatSemaine(mondayStr: string): string {
    if (!mondayStr) return '';
    const monday = new Date(mondayStr + 'T00:00:00');
    const friday = new Date(monday);
    friday.setDate(friday.getDate() + 4);
    const m = monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', '');
    const f = friday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', '');
    return `${m} au ${f}`;
  }

  private getCurrentMonday(): string {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(today.getFullYear(), today.getMonth(), diff);
    const y = mon.getFullYear();
    const m = String(mon.getMonth() + 1).padStart(2, '0');
    const d = String(mon.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  initials(name: string): string {
    return (name || 'RH')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  private monthYear(date: Date): string {
    const label = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return label.substring(0, 1).toUpperCase() + label.substring(1);
  }
}
