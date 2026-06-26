import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  LucideBadgeDollarSign,
  LucideCalendarDays,
  LucideCheckCircle2,
  LucideCircleAlert,
  LucideCircleDollarSign,
  LucideEye,
  LucideFileText,
  LucideImage,
  LucidePencil,
  LucidePlus,
  LucideSearch,
  LucideTrash2,
  LucideTrendingUp,
  LucideUpload,
  LucideWallet,
  LucideX,
} from '@lucide/angular';
import { environment } from '../../environments/environment';

type DrawerMode = 'create' | 'detail' | 'edit';
type PeriodFilter = 'all' | 'month' | 'previousMonth' | 'year';

interface Expense {
  id: number;
  motif: string;
  montant: number;
  dateHeure: string;
  note?: string | null;
  justificatifUrl?: string | null;
  justificatifOriginalName?: string | null;
  createdAt?: string;
  updatedAt?: string | null;
}

interface ExpenseSummary {
  total: number;
  monthTotal: number;
  count: number;
  lastAmount: number;
  lastMotif?: string | null;
}

@Component({
  standalone: true,
  selector: 'app-expenses',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DecimalPipe,
    DatePipe,
    LucideBadgeDollarSign,
    LucideCalendarDays,
    LucideCheckCircle2,
    LucideCircleAlert,
    LucideCircleDollarSign,
    LucideEye,
    LucideFileText,
    LucideImage,
    LucidePencil,
    LucidePlus,
    LucideSearch,
    LucideTrash2,
    LucideTrendingUp,
    LucideUpload,
    LucideWallet,
    LucideX,
  ],
  templateUrl: './expenses.component.html',
  styleUrl: './expenses.component.scss',
})
export class ExpensesComponent implements OnInit {
  expenses: Expense[] = [];
  summary: ExpenseSummary = { total: 0, monthTotal: 0, count: 0, lastAmount: 0, lastMotif: null };
  loading = false;
  saving = false;
  error: string | null = null;
  toast: string | null = null;
  toastType: 'success' | 'error' = 'success';

  search = '';
  period: PeriodFilter = 'all';
  drawerMode: DrawerMode | null = null;
  selected: Expense | null = null;
  deleteTarget: Expense | null = null;
  selectedFile: File | null = null;
  removeJustificatif = false;
  readonly today = new Date();

  form = this.fb.nonNullable.group({
    motif: ['', [Validators.required, Validators.maxLength(150)]],
    montant: [0, [Validators.required, Validators.min(0.01)]],
    dateHeure: [this.nowForInput(), Validators.required],
    note: [''],
  });

  constructor(
    private readonly http: HttpClient,
    private readonly fb: FormBuilder,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  get filteredExpenses(): Expense[] {
    const q = this.search.trim().toLowerCase();
    return this.expenses.filter((expense) => {
      const matchesSearch = !q
        || expense.motif.toLowerCase().includes(q)
        || (expense.note ?? '').toLowerCase().includes(q);
      return matchesSearch && this.matchesPeriod(expense);
    });
  }

  get filteredTotal(): number {
    return this.filteredExpenses.reduce((sum, expense) => sum + Number(expense.montant || 0), 0);
  }

  get drawerTitle(): string {
    if (this.drawerMode === 'create') {
      return 'Nouvelle dépense';
    }
    if (this.drawerMode === 'edit') {
      return 'Modifier la dépense';
    }
    return this.selected?.motif ?? 'Détails de la dépense';
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.http.get<Expense[]>(`${environment.apiUrl}/api/expenses`).subscribe({
      next: (rows) => {
        this.expenses = rows;
        this.loading = false;
        this.loadSummary();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error ?? 'Erreur lors du chargement des dépenses.';
      },
    });
  }

  loadSummary(): void {
    this.http.get<ExpenseSummary>(`${environment.apiUrl}/api/expenses/summary`).subscribe({
      next: (summary) => this.summary = summary,
      error: () => {
        this.summary = {
          total: this.expenses.reduce((sum, e) => sum + Number(e.montant || 0), 0),
          monthTotal: this.monthTotalFromRows(),
          count: this.expenses.length,
          lastAmount: this.expenses[0]?.montant ?? 0,
          lastMotif: this.expenses[0]?.motif ?? null,
        };
      },
    });
  }

  openCreate(): void {
    this.drawerMode = 'create';
    this.selected = null;
    this.selectedFile = null;
    this.removeJustificatif = false;
    this.form.reset({ motif: '', montant: 0, dateHeure: this.nowForInput(), note: '' });
  }

  openDetail(expense: Expense): void {
    this.drawerMode = 'detail';
    this.selected = expense;
  }

  openEdit(expense: Expense): void {
    this.drawerMode = 'edit';
    this.selected = expense;
    this.selectedFile = null;
    this.removeJustificatif = false;
    this.form.reset({
      motif: expense.motif,
      montant: Number(expense.montant),
      dateHeure: this.toInputDateTime(expense.dateHeure),
      note: expense.note ?? '',
    });
  }

  closeDrawer(): void {
    if (this.saving) {
      return;
    }
    this.drawerMode = null;
    this.selected = null;
    this.selectedFile = null;
    this.removeJustificatif = false;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
    if (this.selectedFile) {
      this.removeJustificatif = false;
    }
  }

  clearExistingFile(): void {
    this.removeJustificatif = true;
  }

  submit(): void {
    if (this.form.invalid || this.drawerMode === 'detail') {
      this.form.markAllAsTouched();
      if (this.form.controls.montant.invalid) {
        this.showToast('Montant invalide', 'error');
      } else {
        this.showToast('Veuillez remplir les champs obligatoires', 'error');
      }
      return;
    }
    this.saving = true;
    this.error = null;
    const formData = this.buildFormData();
    const mode = this.drawerMode;
    const request = this.drawerMode === 'edit' && this.selected
      ? this.http.put<Expense>(`${environment.apiUrl}/api/expenses/${this.selected.id}`, formData)
      : this.http.post<Expense>(`${environment.apiUrl}/api/expenses`, formData);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.closeDrawer();
        this.showToast(mode === 'edit' ? 'Dépense modifiée' : 'Dépense ajoutée', 'success');
        this.load();
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.error ?? 'Erreur lors de l’enregistrement.';
      },
    });
  }

  confirmDelete(expense: Expense): void {
    this.deleteTarget = expense;
  }

  cancelDelete(): void {
    this.deleteTarget = null;
  }

  deleteExpense(): void {
    if (!this.deleteTarget) {
      return;
    }
    const target = this.deleteTarget;
    this.http.delete(`${environment.apiUrl}/api/expenses/${target.id}`).subscribe({
      next: () => {
        this.deleteTarget = null;
        this.showToast('Dépense supprimée', 'success');
        this.load();
      },
      error: (err) => {
        this.error = err?.error?.error ?? 'Erreur lors de la suppression.';
      },
    });
  }

  fileUrl(path?: string | null): string {
    return path ? `${environment.apiUrl}${path}` : '';
  }

  fileIcon(expense: Expense): 'pdf' | 'image' {
    const name = (expense.justificatifOriginalName || expense.justificatifUrl || '').toLowerCase();
    return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') ? 'image' : 'pdf';
  }

  setSearch(value: string): void {
    this.search = value;
  }

  setPeriod(value: string): void {
    this.period = value as PeriodFilter;
  }

  private buildFormData(): FormData {
    const raw = this.form.getRawValue();
    const formData = new FormData();
    formData.append('motif', raw.motif.trim());
    formData.append('montant', String(raw.montant));
    formData.append('dateHeure', raw.dateHeure);
    formData.append('note', raw.note?.trim() ?? '');
    formData.append('removeJustificatif', String(this.removeJustificatif));
    if (this.selectedFile) {
      formData.append('justificatif', this.selectedFile);
    }
    return formData;
  }

  private matchesPeriod(expense: Expense): boolean {
    if (this.period === 'all') {
      return true;
    }
    const date = new Date(expense.dateHeure);
    const now = new Date();
    if (this.period === 'month') {
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    }
    if (this.period === 'year') {
      return date.getFullYear() === now.getFullYear();
    }
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return date.getFullYear() === previous.getFullYear() && date.getMonth() === previous.getMonth();
  }

  private monthTotalFromRows(): number {
    const now = new Date();
    return this.expenses
      .filter((expense) => {
        const date = new Date(expense.dateHeure);
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
      })
      .reduce((sum, expense) => sum + Number(expense.montant || 0), 0);
  }

  private nowForInput(): string {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }

  private toInputDateTime(value: string): string {
    if (!value) {
      return this.nowForInput();
    }
    return value.slice(0, 16);
  }

  private showToast(message: string, type: 'success' | 'error' = 'success'): void {
    this.toast = message;
    this.toastType = type;
    window.setTimeout(() => {
      if (this.toast === message) {
        this.toast = null;
      }
    }, 2600);
  }
}
