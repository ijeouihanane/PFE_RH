import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LucideCalendarDays,
  LucideCheckCircle2,
  LucideChevronRight,
  LucideCircleAlert,
  LucideCircleCheck,
  LucideClock3,
  LucideFileText,
  LucideGauge,
  LucideLayers3,
  LucideRotateCcw,
  LucideSearch,
  LucideShieldCheck,
  LucideUserRound,
} from '@lucide/angular';
import { Appraisal, AppraisalStatus } from './appraisal.model';
import { AppraisalService } from './appraisal.service';

type ReviewFilter = 'ALL' | 'TO_CONSULT' | 'IN_VALIDATION' | 'VALIDATED';
type ToastKind = 'success' | 'error';

@Component({
  standalone: true,
  selector: 'app-my-appraisals',
  imports: [
    CommonModule,
    FormsModule,
    LucideCalendarDays,
    LucideCheckCircle2,
    LucideChevronRight,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideClock3,
    LucideFileText,
    LucideGauge,
    LucideLayers3,
    LucideRotateCcw,
    LucideSearch,
    LucideShieldCheck,
    LucideUserRound,
  ],
  templateUrl: './my-appraisals.component.html',
  styleUrl: './my-appraisals.component.scss',
})
export class MyAppraisalsComponent implements OnInit, OnDestroy {
  rows: Appraisal[] = [];
  selected: Appraisal | null = null;
  employeeComment = '';
  searchText = '';
  activeFilter: ReviewFilter = 'ALL';
  selectedYear = 'ALL';
  loadingRows = true;
  acknowledging = false;
  toast: { kind: ToastKind; title: string; message: string } | null = null;

  private requestedId: number | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly service: AppraisalService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const rawId = params.get('id');
      this.requestedId = rawId && Number.isFinite(Number(rawId)) ? Number(rawId) : null;
      this.syncSelected();
    });
    this.reload();
  }

  ngOnDestroy(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  get totalCount(): number {
    return this.rows.length;
  }

  get pendingCount(): number {
    return this.rows.filter(item => item.statut === 'SOUMIS').length;
  }

  get acknowledgedCount(): number {
    return this.rows.filter(item => item.statut === 'PRISE_CONNAISSANCE' || item.statut === 'VALIDEE_RH').length;
  }

  get years(): string[] {
    return Array.from(new Set(this.rows.map(item => this.periodYear(item.periode)).filter(Boolean)))
      .sort((a, b) => b.localeCompare(a));
  }

  get filteredRows(): Appraisal[] {
    const query = this.normalize(this.searchText);
    return [...this.rows]
      .filter(item => {
        if (this.activeFilter === 'TO_CONSULT' && item.statut !== 'SOUMIS') return false;
        if (this.activeFilter === 'IN_VALIDATION' && item.statut !== 'PRISE_CONNAISSANCE') return false;
        if (this.activeFilter === 'VALIDATED' && item.statut !== 'VALIDEE_RH') return false;
        if (this.selectedYear !== 'ALL' && this.periodYear(item.periode) !== this.selectedYear) return false;

        if (!query) return true;
        return [
          item.periode,
          item.managerName,
          item.gridLabel,
          item.positioningCategory,
        ].some(value => this.normalize(value).includes(query));
      })
      .sort((a, b) => this.timestamp(b) - this.timestamp(a));
  }

  reload(): void {
    this.loadingRows = true;
    this.service.employeeList().subscribe({
      next: rows => {
        this.rows = rows;
        this.loadingRows = false;
        this.syncSelected();
      },
      error: error => {
        this.rows = [];
        this.loadingRows = false;
        this.showToast('error', 'Chargement impossible', this.apiError(error, 'Impossible de charger vos appréciations.'));
      },
    });
  }

  openDetail(item: Appraisal): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { id: item.id },
    });
  }

  resetFilters(): void {
    this.searchText = '';
    this.activeFilter = 'ALL';
    this.selectedYear = 'ALL';
  }

  acknowledge(item: Appraisal): void {
    if (this.acknowledging) return;

    this.acknowledging = true;
    this.service.acknowledge(item.id, this.employeeComment.trim()).subscribe({
      next: updated => {
        this.rows = this.rows.map(row => row.id === updated.id ? updated : row);
        this.selected = updated;
        this.employeeComment = updated.employeeComment ?? '';
        this.acknowledging = false;
        this.showToast(
          'success',
          'Prise de connaissance enregistrée',
          'Votre prise de connaissance a bien été enregistrée.',
        );
      },
      error: error => {
        this.acknowledging = false;
        this.showToast('error', 'Action impossible', this.apiError(error, 'La prise de connaissance n’a pas pu être enregistrée.'));
      },
    });
  }

  setFilter(filter: ReviewFilter): void {
    this.activeFilter = filter;
  }

  statusLabel(status: AppraisalStatus): string {
    return ({
      BROUILLON: 'Brouillon',
      SOUMIS: 'En attente de prise de connaissance',
      PRISE_CONNAISSANCE: 'Prise de connaissance enregistrée',
      VALIDEE_RH: 'Validée par la RH',
    } as Record<AppraisalStatus, string>)[status] ?? status;
  }

  statusBadgeLabel(status: AppraisalStatus): string {
    return ({
      BROUILLON: 'Brouillon',
      SOUMIS: 'À consulter',
      PRISE_CONNAISSANCE: 'En validation',
      VALIDEE_RH: 'Validée',
    } as Record<AppraisalStatus, string>)[status] ?? status;
  }

  getPositioningClass(category: string | null | undefined): string {
    if (!category) return 'pos-neutral';
    const c = category.toUpperCase();
    if (c.includes('FORT') || c.includes('LEADER') || c.includes('SOLIDE') || c.includes('TOP')) return 'pos-success';
    if (c.includes('SOUTENIR') || c.includes('ALERTE') || c.includes('DIFFICULTE')) return 'pos-danger';
    if (c.includes('EVOLUTIF') || c.includes('CONFIRMER') || c.includes('POTENTIEL')) return 'pos-warning';
    return 'pos-info';
  }

  closeDetail(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { id: null },
      queryParamsHandling: 'merge',
    });
  }

  levelLabel(level: string): string {
    return ({
      A_RENFORCER: 'À renforcer',
      EN_PROGRESSION: 'En progression',
      CONFORME: 'Conforme',
      POINT_FORT: 'Point fort',
    } as Record<string, string>)[level] ?? level;
  }

  receivedLabel(item: Appraisal): string {
    const date = item.submittedAt ?? item.createdAt;
    return date ? `Reçue le ${this.formatDate(date)}` : 'Date de réception indisponible';
  }

  acknowledgementLabel(item: Appraisal): string {
    if (item.statut === 'VALIDEE_RH') {
      return item.rhValidatedAt ? `Validée par la RH le ${this.formatDate(item.rhValidatedAt)}` : 'Validée par la RH';
    }
    return item.employeeAcknowledgedAt
      ? `Prise de connaissance le ${this.formatDate(item.employeeAcknowledgedAt)}`
      : 'Prise de connaissance enregistrée';
  }

  formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'date indisponible';
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  private syncSelected(): void {
    if (!this.requestedId) {
      this.selected = null;
      this.employeeComment = '';
      return;
    }
    if (this.loadingRows) return;

    const match = this.rows.find(item => item.id === this.requestedId) ?? null;
    if (!match) {
      this.selected = null;
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true,
      });
      return;
    }

    this.selected = match;
    this.employeeComment = match.employeeComment ?? '';
  }

  private periodYear(period: string | null | undefined): string {
    return period?.match(/\b(19|20)\d{2}\b/)?.[0] ?? '';
  }

  private timestamp(item: Appraisal): number {
    const value = item.updatedAt ?? item.createdAt;
    const timestamp = value ? new Date(value).getTime() : 0;
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  private normalize(value: string | null | undefined): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private showToast(kind: ToastKind, title: string, message: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast = { kind, title, message };
    this.toastTimer = setTimeout(() => {
      this.toast = null;
      this.toastTimer = null;
    }, 3200);
  }

  private apiError(error: any, fallback: string): string {
    return error?.error?.error ?? fallback;
  }
}
