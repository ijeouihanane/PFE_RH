import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideBedDouble,
  LucideCar,
  LucideCheck,
  LucideCheckCircle2,
  LucideCircleDollarSign,
  LucideClock,
  LucideEye,
  LucideFileText,
  LucideFuel,
  LucideHistory,
  LucideImage,
  LucideLaptop,
  LucideMoreHorizontal,
  LucidePaperclip,
  LucidePhone,
  LucideReceipt,
  LucideSearch,
  LucideUpload,
  LucideUtensils,
  LucideWallet,
  LucideX,
  LucideXCircle,
} from '@lucide/angular';
import { environment } from '../../environments/environment';
import {
  ExpenseClaim,
  ExpenseClaimCategory,
  ExpenseClaimStatus,
  ExpenseClaimSummary,
  ReimbursementMode,
  expenseClaimCategories,
  expenseClaimStatuses,
} from './expense-claims.model';
import { ExpenseClaimsService } from './expense-claims.service';

type PeriodFilter = 'all' | 'month' | 'previousMonth' | 'year';

@Component({
  standalone: true,
  selector: 'app-rh-expense-claims',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DecimalPipe,
    DatePipe,
    LucideBedDouble,
    LucideCar,
    LucideCheck,
    LucideCheckCircle2,
    LucideCircleDollarSign,
    LucideClock,
    LucideEye,
    LucideFileText,
    LucideFuel,
    LucideHistory,
    LucideImage,
    LucideLaptop,
    LucideMoreHorizontal,
    LucidePaperclip,
    LucidePhone,
    LucideReceipt,
    LucideSearch,
    LucideUpload,
    LucideUtensils,
    LucideWallet,
    LucideX,
    LucideXCircle,
  ],
  templateUrl: './rh-expense-claims.component.html',
  styleUrl: './expense-claims.component.scss',
})
export class RhExpenseClaimsComponent implements OnInit {
  claims: ExpenseClaim[] = [];
  summary: ExpenseClaimSummary = { totalSubmitted: 0, pendingAmount: 0, approvedAmount: 0, reimbursedAmount: 0, pendingCount: 0, requestCount: 0 };
  categories = expenseClaimCategories;
  statuses = expenseClaimStatuses;
  loading = false;
  error: string | null = null;
  toast: string | null = null;
  search = '';
  status: ExpenseClaimStatus | 'ALL' = 'ALL';
  period: PeriodFilter = 'all';
  detailTarget: ExpenseClaim | null = null;
  rejectTarget: ExpenseClaim | null = null;
  reimburseTarget: ExpenseClaim | null = null;
  reimbursementProof: File | null = null;

  rejectForm = this.fb.nonNullable.group({
    reason: ['', Validators.required],
  });

  reimburseForm = this.fb.nonNullable.group({
    mode: ['VIREMENT' as ReimbursementMode, Validators.required],
    date: [this.todayInput(), Validators.required],
    note: [''],
  });

  constructor(
    private readonly service: ExpenseClaimsService,
    private readonly fb: FormBuilder,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  get filteredClaims(): ExpenseClaim[] {
    const q = this.search.trim().toLowerCase();
    return this.claims.filter((claim) => {
      const searchOk = !q
        || claim.employeeLabel.toLowerCase().includes(q)
        || claim.motif.toLowerCase().includes(q)
        || (claim.note ?? '').toLowerCase().includes(q);
      const statusOk = this.status === 'ALL' || claim.status === this.status;
      return searchOk && statusOk && this.matchesPeriod(claim);
    });
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.service.rhClaims().subscribe({
      next: (rows) => {
        this.claims = rows;
        this.loading = false;
        this.loadSummary();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error ?? 'Erreur lors du chargement des frais salariés.';
      },
    });
  }

  loadSummary(): void {
    this.service.rhSummary().subscribe({
      next: (summary) => this.summary = summary,
      error: () => this.summary = this.summaryFromRows(this.claims),
    });
  }

  approve(claim: ExpenseClaim): void {
    this.service.approve(claim.id).subscribe({
      next: () => {
        this.showToast(`Demande approuvée pour ${claim.employeeLabel}`);
        this.load();
      },
      error: (err) => this.error = err?.error?.error ?? 'Erreur lors de l’approbation.',
    });
  }

  openReject(claim: ExpenseClaim): void {
    this.rejectTarget = claim;
    this.rejectForm.reset({ reason: '' });
  }

  reject(): void {
    if (!this.rejectTarget || this.rejectForm.invalid) {
      this.rejectForm.markAllAsTouched();
      return;
    }
    const target = this.rejectTarget;
    this.service.reject(target.id, this.rejectForm.getRawValue().reason).subscribe({
      next: () => {
        this.rejectTarget = null;
        this.showToast(`Demande refusée pour ${target.employeeLabel}`);
        this.load();
      },
      error: (err) => this.error = err?.error?.error ?? 'Erreur lors du refus.',
    });
  }

  openReimburse(claim: ExpenseClaim): void {
    this.reimburseTarget = claim;
    this.reimbursementProof = null;
    this.reimburseForm.reset({ mode: 'VIREMENT', date: this.todayInput(), note: '' });
  }

  onProofSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.reimbursementProof = input.files?.[0] ?? null;
  }

  reimburse(): void {
    if (!this.reimburseTarget || this.reimburseForm.invalid) {
      this.reimburseForm.markAllAsTouched();
      return;
    }
    const target = this.reimburseTarget;
    const raw = this.reimburseForm.getRawValue();
    this.service.reimburse(target.id, { mode: raw.mode, date: raw.date, note: raw.note, proof: this.reimbursementProof }).subscribe({
      next: () => {
        this.reimburseTarget = null;
        this.showToast(`Remboursement confirmé pour ${target.employeeLabel}`);
        this.load();
      },
      error: (err) => this.error = err?.error?.error ?? 'Erreur lors du remboursement.',
    });
  }

  fileUrl(path?: string | null): string {
    return path ? `${environment.apiUrl}${path}` : '';
  }

  setSearch(value: string): void { this.search = value; }
  setStatus(value: string): void { this.status = value as ExpenseClaimStatus | 'ALL'; }
  setPeriod(value: string): void { this.period = value as PeriodFilter; }

  categoryLabel(category: ExpenseClaimCategory): string {
    return this.categories.find((c) => c.value === category)?.label ?? category;
  }

  statusLabel(status: ExpenseClaimStatus): string {
    return status === 'APPROUVE' ? 'APPROUVÉ' : status === 'REFUSE' ? 'REFUSÉ' : status === 'REMBOURSE' ? 'REMBOURSÉ' : 'SOUMIS';
  }

  modeLabel(mode?: string | null): string {
    if (mode === 'ESPECES') return 'Espèces';
    if (mode === 'VIREMENT') return 'Virement';
    if (mode === 'AUTRE') return 'Autre';
    return '—';
  }

  private matchesPeriod(claim: ExpenseClaim): boolean {
    if (this.period === 'all') return true;
    const date = new Date(claim.dateHeure);
    const now = new Date();
    if (this.period === 'month') return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    if (this.period === 'year') return date.getFullYear() === now.getFullYear();
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return date.getFullYear() === previous.getFullYear() && date.getMonth() === previous.getMonth();
  }

  private summaryFromRows(rows: ExpenseClaim[]): ExpenseClaimSummary {
    const byStatus = (status: ExpenseClaimStatus) => rows.filter((c) => c.status === status).reduce((sum, c) => sum + Number(c.montant || 0), 0);
    return {
      totalSubmitted: rows.reduce((sum, c) => sum + Number(c.montant || 0), 0),
      pendingAmount: byStatus('SOUMIS'),
      approvedAmount: byStatus('APPROUVE'),
      reimbursedAmount: byStatus('REMBOURSE'),
      pendingCount: rows.filter((c) => c.status === 'SOUMIS').length,
      requestCount: rows.length,
    };
  }

  private todayInput(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private showToast(message: string): void {
    this.toast = message;
    window.setTimeout(() => {
      if (this.toast === message) this.toast = null;
    }, 2600);
  }
}
