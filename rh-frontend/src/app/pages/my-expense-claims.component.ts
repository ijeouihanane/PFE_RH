import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideBedDouble,
  LucideCar,
  LucideCheckCircle2,
  LucideCircleAlert,
  LucideCircleDollarSign,
  LucideClock,
  LucideEye,
  LucideFileText,
  LucideFuel,
  LucideImage,
  LucideLaptop,
  LucideMoreHorizontal,
  LucidePaperclip,
  LucidePencil,
  LucidePhone,
  LucidePlus,
  LucideReceipt,
  LucideSearch,
  LucideTrash2,
  LucideUpload,
  LucideUtensils,
  LucideWallet,
  LucideX,
} from '@lucide/angular';
import { environment } from '../../environments/environment';
import { AuthService } from '../core/auth.service';
import {
  ExpenseClaim,
  ExpenseClaimCategory,
  ExpenseClaimStatus,
  ExpenseClaimSummary,
  expenseClaimCategories,
  expenseClaimStatuses,
} from './expense-claims.model';
import { ExpenseClaimsService } from './expense-claims.service';

type DrawerMode = 'create' | 'detail' | 'edit';
type PeriodFilter = 'all' | 'month' | 'previousMonth' | 'year';

@Component({
  standalone: true,
  selector: 'app-my-expense-claims',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DecimalPipe,
    DatePipe,
    LucideBedDouble,
    LucideCar,
    LucideCheckCircle2,
    LucideCircleAlert,
    LucideCircleDollarSign,
    LucideClock,
    LucideEye,
    LucideFileText,
    LucideFuel,
    LucideImage,
    LucideLaptop,
    LucideMoreHorizontal,
    LucidePaperclip,
    LucidePencil,
    LucidePhone,
    LucidePlus,
    LucideReceipt,
    LucideSearch,
    LucideTrash2,
    LucideUpload,
    LucideUtensils,
    LucideWallet,
    LucideX,
  ],
  templateUrl: './my-expense-claims.component.html',
  styleUrl: './expense-claims.component.scss',
})
export class MyExpenseClaimsComponent implements OnInit {
  claims: ExpenseClaim[] = [];
  summary: ExpenseClaimSummary = { totalSubmitted: 0, pendingAmount: 0, approvedAmount: 0, reimbursedAmount: 0, pendingCount: 0, requestCount: 0 };
  categories = expenseClaimCategories;
  statuses = expenseClaimStatuses;
  loading = false;
  saving = false;
  error: string | null = null;
  toast: string | null = null;
  toastType: 'success' | 'error' = 'success';
  search = '';
  status: ExpenseClaimStatus | 'ALL' = 'ALL';
  period: PeriodFilter = 'all';
  drawerMode: DrawerMode | null = null;
  selected: ExpenseClaim | null = null;
  deleteTarget: ExpenseClaim | null = null;
  selectedFile: File | null = null;

  form = this.fb.nonNullable.group({
    motif: ['', [Validators.required, Validators.maxLength(150)]],
    categorie: ['TRANSPORT' as ExpenseClaimCategory, Validators.required],
    montant: [0, [Validators.required, Validators.min(0.01)]],
    dateHeure: ['', Validators.required],
    note: [''],
  });

  constructor(
    private readonly service: ExpenseClaimsService,
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  get filteredClaims(): ExpenseClaim[] {
    const q = this.search.trim().toLowerCase();
    return this.claims.filter((claim) => {
      const searchOk = !q || claim.motif.toLowerCase().includes(q) || (claim.note ?? '').toLowerCase().includes(q);
      const statusOk = this.status === 'ALL' || claim.status === this.status;
      return searchOk && statusOk && this.matchesPeriod(claim);
    });
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.service.myClaims().subscribe({
      next: (rows) => {
        this.claims = rows;
        this.loading = false;
        this.loadSummary();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error ?? 'Erreur lors du chargement des frais.';
      },
    });
  }

  loadSummary(): void {
    this.service.mySummary().subscribe({
      next: (summary) => this.summary = summary,
      error: () => this.summary = this.summaryFromRows(this.claims),
    });
  }

  openCreate(): void {
    this.drawerMode = 'create';
    this.selected = null;
    this.selectedFile = null;
    this.form.reset({ motif: '', categorie: 'TRANSPORT', montant: 0, dateHeure: '', note: '' });
  }

  openDetail(claim: ExpenseClaim): void {
    this.drawerMode = 'detail';
    this.selected = claim;
  }

  openEdit(claim: ExpenseClaim): void {
    if (claim.status !== 'SOUMIS') {
      return;
    }
    this.drawerMode = 'edit';
    this.selected = claim;
    this.selectedFile = null;
    this.form.reset({
      motif: claim.motif,
      categorie: claim.categorie,
      montant: Number(claim.montant),
      dateHeure: claim.dateHeure.slice(0, 16),
      note: claim.note ?? '',
    });
  }

  closeDrawer(): void {
    if (this.saving) {
      return;
    }
    this.drawerMode = null;
    this.selected = null;
    this.selectedFile = null;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
  }

  submit(): void {
    if (this.form.invalid || this.drawerMode === 'detail') {
      this.form.markAllAsTouched();
      this.showToast('Veuillez remplir tous les champs obligatoires.', 'error');
      return;
    }
    if (this.drawerMode === 'create' && !this.selectedFile) {
      this.error = 'Le justificatif est obligatoire.';
      this.showToast('Le justificatif est obligatoire.', 'error');
      return;
    }
    this.saving = true;
    this.error = null;
    const mode = this.drawerMode;
    const request = mode === 'edit' && this.selected
      ? this.service.update(this.selected.id, this.buildFormData())
      : this.service.create(this.buildFormData());

    request.subscribe({
      next: () => {
        this.saving = false;
        this.closeDrawer();
        this.showToast(mode === 'edit' ? 'Demande modifiée' : 'Demande soumise');
        this.load();
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.error ?? 'Erreur lors de l’enregistrement.';
      },
    });
  }

  confirmDelete(claim: ExpenseClaim): void {
    if (claim.status === 'SOUMIS') {
      this.deleteTarget = claim;
    }
  }

  deleteClaim(): void {
    if (!this.deleteTarget) {
      return;
    }
    this.service.delete(this.deleteTarget.id).subscribe({
      next: () => {
        this.deleteTarget = null;
        this.showToast('Demande supprimée');
        this.load();
      },
      error: (err) => this.error = err?.error?.error ?? 'Erreur lors de la suppression.',
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

  private buildFormData(): FormData {
    const raw = this.form.getRawValue();
    const user = this.auth.user;
    const formData = new FormData();
    formData.append('employeeFirstName', user?.prenom ?? '');
    formData.append('employeeLastName', user?.nom ?? '');
    formData.append('motif', raw.motif.trim());
    formData.append('categorie', raw.categorie);
    formData.append('montant', String(raw.montant));
    formData.append('dateHeure', raw.dateHeure);
    formData.append('note', raw.note.trim());
    if (this.selectedFile) {
      formData.append('justificatif', this.selectedFile);
    }
    return formData;
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

  private showToast(message: string, type: 'success' | 'error' = 'success'): void {
    this.toast = message;
    this.toastType = type;
    window.setTimeout(() => {
      if (this.toast === message) this.toast = null;
    }, 2600);
  }
}
