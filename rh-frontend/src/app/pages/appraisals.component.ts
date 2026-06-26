import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import {
  Appraisal,
  AppraisalContext,
  CriterionLevel,
  DraftPayload,
  Performance,
  Potential,
} from './appraisal.model';
import { AppraisalService } from './appraisal.service';

type AnswerState = { level: CriterionLevel | null; comment: string };

import {
  LucideUsers,
  LucideFileEdit,
  LucideClock3,
  LucideCheckCircle2,
  LucideAlertCircle
} from '@lucide/angular';

@Component({
  standalone: true,
  selector: 'app-appraisals',
  imports: [
    CommonModule,
    FormsModule,
    LucideUsers,
    LucideFileEdit,
    LucideClock3,
    LucideCheckCircle2,
    LucideAlertCircle
  ],
  templateUrl: './appraisals.component.html',
  styleUrl: './appraisals.component.scss',
})
export class AppraisalsComponent implements OnInit {
  readonly levels: Array<{ value: CriterionLevel; label: string }> = [
    { value: 'A_RENFORCER', label: 'À renforcer' },
    { value: 'EN_PROGRESSION', label: 'En progression' },
    { value: 'CONFORME', label: 'Conforme' },
    { value: 'POINT_FORT', label: 'Point fort' },
  ];
  readonly performances: Array<{ value: Performance; title: string; description: string }> = [
    { value: 'A_RENFORCER', title: 'À renforcer', description: 'En dessous des attentes du poste.' },
    { value: 'CONFORME', title: 'Conforme aux attentes', description: 'Répond aux exigences du poste.' },
    { value: 'SUPERIEURE', title: 'Supérieure aux attentes', description: 'Dépasse régulièrement les attentes.' },
  ];
  readonly potentials: Array<{ value: Potential; title: string; description: string }> = [
    { value: 'A_CONFIRMER', title: 'À confirmer', description: 'Consolider le poste actuel.' },
    { value: 'EVOLUTIF', title: 'Évolutif', description: 'Peut progresser à moyen terme.' },
    { value: 'FORT', title: 'Fort potentiel', description: 'Candidat à une évolution rapide.' },
  ];

  employees: any[] = [];
  appraisals: Appraisal[] = [];
  context: AppraisalContext | null = null;
  selectedEmployeeId = 0;
  period = '';
  step = 1;
  draftId: number | null = null;
  performance: Performance | null = null;
  potential: Potential | null = null;
  generatedSummary = '';
  managerComment = '';
  answers: Record<number, AnswerState> = {};
  editorOpen = false;
  loading = false;
  error: string | null = null;
  success: string | null = null;

  // Search, Filter & Sort toolbar
  searchText = '';
  activeFilter: 'TOUS' | 'BROUILLON' | 'EN_ATTENTE' | 'VALIDEE_RH' = 'TOUS';
  sortBy: 'date' | 'name' = 'date';

  // Toast controls
  toast: { message: string; type: 'success' | 'error' } | null = null;
  private toastTimeoutId: any = null;

  constructor(
    private readonly http: HttpClient,
    private readonly appraisalService: AppraisalService,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.http.get<any[]>(`${environment.apiUrl}/api/users/team`).subscribe(rows => this.employees = rows);
    this.reload();
  }

  reload(): void {
    this.appraisalService.managerList().subscribe({
      next: rows => {
        this.appraisals = rows;
        this.checkViewId();
      },
      error: () => this.appraisals = [],
    });
  }

  private checkViewId(): void {
    const viewId = this.route.snapshot.queryParams['viewId'];
    if (viewId) {
      const id = Number(viewId);
      const appraisal = this.appraisals.find(a => a.id === id);
      if (appraisal) this.editDraft(appraisal);
    }
  }

  startNew(): void {
    this.resetEditor();
    this.editorOpen = true;
  }

  editDraft(appraisal: Appraisal): void {
    if (appraisal.statut !== 'BROUILLON') return;
    this.resetEditor();
    this.editorOpen = true;
    this.selectedEmployeeId = appraisal.employeeId;
    this.draftId = appraisal.id;
    this.period = appraisal.periode;
    this.performance = appraisal.performance ?? null;
    this.potential = appraisal.potential ?? null;
    this.generatedSummary = appraisal.generatedSummary ?? '';
    this.managerComment = appraisal.managerComment ?? '';
    this.loadDraftContext(appraisal.id, () => {
      appraisal.answers.forEach(answer => {
        this.answers[answer.criterionId] = {
          level: answer.level,
          comment: answer.comment ?? '',
        };
      });
    });
  }

  private loadDraftContext(draftId: number, afterLoad?: () => void): void {
    this.loading = true;
    this.appraisalService.draftContext(draftId).subscribe({
      next: context => {
        this.initializeContext(context);
        afterLoad?.();
        this.loading = false;
      },
      error: e => {
        this.showToast(this.apiError(e), 'error');
        this.loading = false;
      },
    });
  }

  onEmployeeChange(): void {
    this.draftId = null;
    this.performance = null;
    this.potential = null;
    this.generatedSummary = '';
    this.managerComment = '';
    this.loadContext();
  }

  loadContext(afterLoad?: () => void): void {
    if (!this.selectedEmployeeId) {
      this.context = null;
      return;
    }
    this.loading = true;
    this.appraisalService.context(this.selectedEmployeeId).subscribe({
      next: context => {
        this.initializeContext(context);
        afterLoad?.();
        this.loading = false;
      },
      error: e => {
        this.showToast(this.apiError(e), 'error');
        this.loading = false;
      },
    });
  }

  private initializeContext(context: AppraisalContext): void {
    this.context = context;
    if (!this.period) this.period = context.defaultPeriod;
    this.answers = {};
    context.criteria.forEach(criterion => {
      this.answers[criterion.id] = { level: null, comment: '' };
    });
  }

  selectLevel(criterionId: number, level: CriterionLevel): void {
    this.answers[criterionId].level = level;
    this.generatedSummary = '';
  }

  selectPerformance(value: Performance): void {
    this.performance = value;
    this.generatedSummary = '';
  }

  selectPotential(value: Potential): void {
    this.potential = value;
    this.generatedSummary = '';
  }

  showToast(message: string, type: 'success' | 'error' = 'success'): void {
    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
      this.toastTimeoutId = null;
    }
    this.toast = { message, type };
    this.toastTimeoutId = setTimeout(() => {
      this.toast = null;
      this.toastTimeoutId = null;
    }, 3000);
  }

  get stats() {
    return {
      teamCount: this.employees.length,
      draftCount: this.appraisals.filter(a => a.statut === 'BROUILLON').length,
      pendingCount: this.appraisals.filter(a => a.statut === 'SOUMIS' || a.statut === 'PRISE_CONNAISSANCE').length,
      validatedCount: this.appraisals.filter(a => a.statut === 'VALIDEE_RH').length,
    };
  }

  get filteredAppraisals(): Appraisal[] {
    let list = [...this.appraisals];

    // 1. Filter by status
    if (this.activeFilter === 'BROUILLON') {
      list = list.filter(a => a.statut === 'BROUILLON');
    } else if (this.activeFilter === 'EN_ATTENTE') {
      list = list.filter(a => a.statut === 'SOUMIS' || a.statut === 'PRISE_CONNAISSANCE');
    } else if (this.activeFilter === 'VALIDEE_RH') {
      list = list.filter(a => a.statut === 'VALIDEE_RH');
    }

    // 2. Filter by search text
    if (this.searchText.trim()) {
      const q = this.searchText.toLowerCase().trim();
      list = list.filter(a => {
        const name = (a.employeeName || '').toLowerCase();
        const dept = (a.employeeDepartment || '').toLowerCase();
        const period = (a.periode || '').toLowerCase();
        const pos = (a.positioningCategory || '').toLowerCase();
        return name.includes(q) || dept.includes(q) || period.includes(q) || pos.includes(q);
      });
    }

    // 3. Sort
    list.sort((a, b) => {
      if (this.sortBy === 'name') {
        return (a.employeeName || '').localeCompare(b.employeeName || '');
      } else {
        const dateA = new Date(a.updatedAt || a.createdAt).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt).getTime();
        
        const timeA = isNaN(dateA) ? 0 : dateA;
        const timeB = isNaN(dateB) ? 0 : dateB;
        
        return timeB - timeA;
      }
    });

    return list;
  }

  getProgression(status: string): number {
    switch (status) {
      case 'BROUILLON': return 25;
      case 'SOUMIS': return 50;
      case 'PRISE_CONNAISSANCE': return 75;
      case 'VALIDEE_RH': return 100;
      default: return 0;
    }
  }

  getPositioningClass(category: string | null | undefined): string {
    if (!category) return 'pos-neutral';
    const cat = category.toLowerCase();
    if (cat.includes('talent') || cat.includes('sur-performance') || cat.includes('conforme') || cat.includes('solide') || cat.includes('supérieure')) {
      return 'pos-success';
    }
    if (cat.includes('soutenir') || cat.includes('observer') || cat.includes('inexploité')) {
      return 'pos-warning';
    }
    if (cat.includes('redresser') || cat.includes('sous-performance')) {
      return 'pos-danger';
    }
    return 'pos-info';
  }

  formatLastUpdated(item: Appraisal): string {
    const dateStr = item.updatedAt || item.createdAt;
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return 'Date invalide';
    }
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
      if (diffHours === 0) {
        return 'À l\'instant';
      }
      return `Maj il y a ${diffHours} h`;
    }
    if (diffDays === 1) {
      return 'Maj hier';
    }
    if (diffDays < 7) {
      return `Maj il y a ${diffDays} j`;
    }
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks === 1) {
      return 'Maj il y a 1 sem.';
    }
    if (diffWeeks < 4) {
      return `Maj il y a ${diffWeeks} sem.`;
    }
    return `Maj le ${date.toLocaleDateString('fr-FR')}`;
  }

  getInitials(name: string): string {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0] ? parts[0][0].toUpperCase() : '';
  }

  async next(): Promise<void> {
    if (this.step === 1 && !this.validCriteria()) {
      this.showToast('Sélectionnez un niveau pour chaque critère et commentez les critères à renforcer.', 'error');
      return;
    }
    if (this.step === 2 && (!this.performance || !this.potential)) {
      this.showToast('Sélectionnez la performance actuelle et le potentiel d’évolution.', 'error');
      return;
    }
    this.saveDraft({
      silent: true,
      afterSave: () => {
        this.step++;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  back(): void {
    if (this.step > 1) this.step--;
  }

  saveDraft(options?: { silent?: boolean; closeWorkflow?: boolean; afterSave?: () => void }): void {
    if (!this.context || !this.selectedEmployeeId || !this.period.trim()) {
      this.showToast('Sélectionnez un employé et renseignez la période.', 'error');
      return;
    }
    this.loading = true;
    const request = this.draftId
      ? this.appraisalService.updateDraft(this.draftId, this.payload())
      : this.appraisalService.createDraft(this.payload());
    request.subscribe({
      next: appraisal => {
        this.draftId = appraisal.id;
        this.generatedSummary = appraisal.generatedSummary ?? this.generatedSummary;
        this.loading = false;
        this.reload();
        
        if (options?.closeWorkflow) {
          this.editorOpen = false;
        }
        
        if (!options?.silent) {
          this.showToast('Brouillon enregistré.', 'success');
        }
        
        options?.afterSave?.();
      },
      error: e => {
        this.showToast(this.apiError(e), 'error');
        this.loading = false;
      },
    });
  }

  submit(): void {
    if (!this.draftId) {
      this.saveDraft({
        silent: true,
        afterSave: () => this.submit()
      });
      return;
    }
    this.loading = true;
    this.appraisalService.updateDraft(this.draftId, this.payload()).subscribe({
      next: saved => {
        this.generatedSummary = saved.generatedSummary ?? this.generatedSummary;
        this.appraisalService.submit(saved.id).subscribe({
          next: () => {
            this.loading = false;
            this.editorOpen = false;
            this.showToast('Appréciation soumise. L’employé peut maintenant en prendre connaissance.', 'success');
            this.reload();
          },
          error: e => {
            this.showToast(this.apiError(e), 'error');
            this.loading = false;
          },
        });
      },
      error: e => {
        this.showToast(this.apiError(e), 'error');
        this.loading = false;
      },
    });
  }

  quit(): void {
    this.editorOpen = false;
    this.toast = null;
  }

  get currentCategory(): string {
    if (!this.performance || !this.potential) return 'À déterminer';
    return this.category(this.performance, this.potential);
  }

  isActiveCell(performance: Performance, potential: Potential): boolean {
    return this.performance === performance && this.potential === potential;
  }

  statusLabel(status: string): string {
    return ({
      BROUILLON: 'Brouillon',
      SOUMIS: 'En attente employé',
      PRISE_CONNAISSANCE: 'Prêt pour validation RH',
      VALIDEE_RH: 'Validée par RH',
    } as Record<string, string>)[status] ?? status;
  }

  private validCriteria(): boolean {
    if (!this.context) return false;
    return this.context.criteria.every(criterion => {
      const answer = this.answers[criterion.id];
      return !!answer?.level
        && (answer.level !== 'A_RENFORCER' || !!answer.comment.trim());
    });
  }

  private payload(): DraftPayload {
    return {
      employeeId: this.selectedEmployeeId,
      periode: this.period.trim(),
      performance: this.performance,
      potential: this.potential,
      generatedSummary: this.generatedSummary.trim() || null,
      managerComment: this.managerComment.trim() || null,
      answers: Object.entries(this.answers)
        .filter(([, answer]) => !!answer.level)
        .map(([criterionId, answer]) => ({
          criterionId: Number(criterionId),
          level: answer.level!,
          comment: answer.comment.trim() || null,
        })),
    };
  }

  category(performance: Performance, potential: Potential): string {
    const map: Record<string, string> = {
      'SUPERIEURE:FORT': 'Talent clé',
      'SUPERIEURE:EVOLUTIF': 'Contributeur solide',
      'SUPERIEURE:A_CONFIRMER': 'Contributeur à soutenir',
      'CONFORME:FORT': 'Profil à promouvoir',
      'CONFORME:EVOLUTIF': 'Collaborateur solide',
      'CONFORME:A_CONFIRMER': 'Profil à observer',
      'A_RENFORCER:FORT': 'Potentiel inexploité',
      'A_RENFORCER:EVOLUTIF': 'À redresser',
      'A_RENFORCER:A_CONFIRMER': 'Sous-performance',
    };
    return map[`${performance}:${potential}`];
  }

  private resetEditor(): void {
    this.context = null;
    this.selectedEmployeeId = 0;
    this.period = '';
    this.step = 1;
    this.draftId = null;
    this.performance = null;
    this.potential = null;
    this.generatedSummary = '';
    this.managerComment = '';
    this.answers = {};
    this.error = null;
    this.success = null;
  }

  private hasInput(): boolean {
    return !!this.selectedEmployeeId || Object.values(this.answers).some(answer => !!answer.level || !!answer.comment);
  }

  private apiError(error: any): string {
    return error?.error?.error ?? 'Une erreur est survenue.';
  }
}
