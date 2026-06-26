import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
import { IIconComponent } from '../core/i-icon.component';

type EmployeeRole = 'EMPLOYEE' | 'MANAGER';
type ContractType = 'CDI' | 'CDD';
type DrawerMode = 'detail' | 'create' | 'edit' | null;
type FormStep = 1 | 2 | 3;

type EmployeeRow = {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  matricule?: string | null;
  telephone?: string | null;
  adresse?: string | null;
  ville?: string | null;
  rib?: string | null;
  dateEmbauche?: string | null;
  etatCivil?: string | null;
  cin?: string | null;
  cnss?: string | null;
  nationalite?: string | null;
  departement?: string | null;
  poste?: string | null;
  typeContrat?: ContractType | string | null;
  role: EmployeeRole | string;
  managerId?: number | null;
  actif?: boolean;
};

@Component({
  standalone: true,
  selector: 'app-employees',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IIconComponent],
  templateUrl: './employees.component.html',
  styleUrl: './employees.component.scss',
})
export class EmployeesComponent implements OnInit {
  readonly departments = ['IT', 'Marketing', 'Finance', 'Commercial', 'Administration', 'RH'];
  readonly roleOptions: Array<{ value: EmployeeRole; label: string }> = [
    { value: 'EMPLOYEE', label: 'Employe' },
    { value: 'MANAGER', label: 'Manager' },
  ];
  readonly contractOptions: Array<{ value: ContractType; label: string }> = [
    { value: 'CDI', label: 'CDI' },
    { value: 'CDD', label: 'CDD' },
  ];

  employees: EmployeeRow[] = [];
  managers: EmployeeRow[] = [];
  error: string | null = null;
  formError: string | null = null;
  drawerMode: DrawerMode = null;
  formStep: FormStep = 1;
  selectedEmployee: EmployeeRow | null = null;
  confirmDeactivateTarget: EmployeeRow | null = null;
  toast: { type: 'success' | 'error'; message: string } | null = null;
  private toastTimeout: any;

  search = '';
  roleFilter: 'ALL' | EmployeeRole = 'ALL';
  departmentFilter = 'ALL';
  contractFilter: 'ALL' | ContractType = 'ALL';
  statusFilter: 'ALL' | 'ACTIVE' | 'INACTIVE' = 'ALL';

  form = this.fb.nonNullable.group({
    nom: ['', [Validators.required]],
    prenom: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    matricule: [''],
    telephone: [''],
    adresse: [''],
    ville: [''],
    rib: [''],
    dateEmbauche: [''],
    etatCivil: [''],
    cin: [''],
    cnss: [''],
    nationalite: ['Marocaine'],
    departement: ['', [Validators.required]],
    poste: [''],
    typeContrat: ['CDI', [Validators.required]],
    role: ['EMPLOYEE', [Validators.required]],
    managerId: [null as number | null],
  });

  editForm = this.fb.nonNullable.group({
    nom: ['', [Validators.required]],
    prenom: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    matricule: [''],
    telephone: [''],
    adresse: [''],
    ville: [''],
    rib: [''],
    dateEmbauche: [''],
    etatCivil: [''],
    cin: [''],
    cnss: [''],
    nationalite: [''],
    departement: ['', [Validators.required]],
    poste: [''],
    typeContrat: ['CDI', [Validators.required]],
    role: ['EMPLOYEE', [Validators.required]],
    managerId: [null as number | null],
  });

  constructor(
    private readonly http: HttpClient,
    private readonly fb: FormBuilder,
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.http.get<EmployeeRow[]>(`${environment.apiUrl}/api/users`).subscribe({
      next: (rows) => {
        const manageable = rows.filter((e) => e.role === 'EMPLOYEE' || e.role === 'MANAGER');
        this.employees = manageable;
        this.managers = manageable.filter((e) => e.role === 'MANAGER' && e.actif !== false);
      },
      error: () => {
        this.error = 'Impossible de charger les collaborateurs.';
      },
    });
  }

  get filteredEmployees(): EmployeeRow[] {
    const term = this.search.trim().toLowerCase();
    return this.employees.filter((e) => {
      const text = `${e.prenom || ''} ${e.nom || ''} ${e.email || ''} ${e.matricule || ''} ${e.poste || ''}`.toLowerCase();
      const active = e.actif !== false;
      return (!term || text.includes(term))
        && (this.roleFilter === 'ALL' || e.role === this.roleFilter)
        && (this.departmentFilter === 'ALL' || e.departement === this.departmentFilter)
        && (this.contractFilter === 'ALL' || e.typeContrat === this.contractFilter)
        && (this.statusFilter === 'ALL'
          || (this.statusFilter === 'ACTIVE' && active)
          || (this.statusFilter === 'INACTIVE' && !active));
    });
  }

  get activeCount(): number {
    return this.employees.filter((e) => e.actif !== false).length;
  }

  get managerCount(): number {
    return this.employees.filter((e) => e.role === 'MANAGER' && e.actif !== false).length;
  }

  get employeeCount(): number {
    return this.employees.filter((e) => e.role === 'EMPLOYEE' && e.actif !== false).length;
  }

  get cddCount(): number {
    return this.employees.filter((e) => e.typeContrat === 'CDD' && e.actif !== false).length;
  }

  get departmentOptions(): string[] {
    return this.departments;
  }

  openCreate(): void {
    this.formError = null;
    this.selectedEmployee = null;
    this.formStep = 1;
    this.drawerMode = 'create';
    this.form.reset({
      nom: '',
      prenom: '',
      email: '',
      matricule: '',
      telephone: '',
      adresse: '',
      ville: '',
      rib: '',
      dateEmbauche: this.today(),
      etatCivil: '',
      cin: '',
      cnss: '',
      nationalite: 'Marocaine',
      departement: '',
      poste: '',
      typeContrat: 'CDI',
      role: 'EMPLOYEE',
      managerId: null,
    });
  }

  openDetail(emp: EmployeeRow): void {
    this.selectedEmployee = emp;
    this.drawerMode = 'detail';
  }

  openEdit(emp: EmployeeRow): void {
    this.formError = null;
    this.selectedEmployee = emp;
    this.formStep = 1;
    this.drawerMode = 'edit';
    this.editForm.setValue({
      nom: emp.nom ?? '',
      prenom: emp.prenom ?? '',
      email: emp.email ?? '',
      matricule: emp.matricule ?? '',
      telephone: emp.telephone ?? '',
      adresse: emp.adresse ?? '',
      ville: emp.ville ?? '',
      rib: emp.rib ?? '',
      dateEmbauche: emp.dateEmbauche ?? '',
      etatCivil: emp.etatCivil ?? '',
      cin: emp.cin ?? '',
      cnss: emp.cnss ?? '',
      nationalite: emp.nationalite ?? '',
      departement: emp.departement ?? '',
      poste: emp.poste ?? '',
      typeContrat: (emp.typeContrat === 'CDD' ? 'CDD' : 'CDI'),
      role: (emp.role === 'MANAGER' ? 'MANAGER' : 'EMPLOYEE'),
      managerId: emp.managerId ?? null,
    });
  }

  closeDrawer(): void {
    this.drawerMode = null;
    this.selectedEmployee = null;
    this.formStep = 1;
    this.formError = null;
  }

  nextStep(): void {
    if (!this.validateStep()) return;
    this.formStep = Math.min(3, this.formStep + 1) as FormStep;
  }

  previousStep(): void {
    this.formStep = Math.max(1, this.formStep - 1) as FormStep;
    this.formError = null;
  }

  create(): void {
    this.formError = null;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError = 'Veuillez remplir les champs obligatoires.';
      return;
    }
    const payload = this.form.getRawValue();
    this.http.post(`${environment.apiUrl}/api/users`, payload).subscribe({
      next: () => {
        this.closeDrawer();
        this.reload();
        this.showToast('success', 'Profil créé avec succès');
      },
      error: (e) => {
        this.formError = e?.error?.message || e?.error?.error || 'Création impossible. Vérifiez l\'email et le matricule.';
      },
    });
  }

  saveEdit(): void {
    this.formError = null;
    if (!this.selectedEmployee || this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      this.formError = 'Veuillez remplir les champs obligatoires.';
      return;
    }
    const { email: _email, ...payload } = this.editForm.getRawValue();
    this.http.put(`${environment.apiUrl}/api/users/${this.selectedEmployee.id}`, payload).subscribe({
      next: () => {
        this.closeDrawer();
        this.reload();
        this.showToast('success', 'Modifications enregistrées');
      },
      error: (e) => {
        this.formError = e?.error?.message || e?.error?.error || 'Modification impossible';
      },
    });
  }

  askDeactivate(emp: EmployeeRow): void {
    this.confirmDeactivateTarget = emp;
  }

  closeDeactivate(): void {
    this.confirmDeactivateTarget = null;
  }

  confirmDeactivate(): void {
    const target = this.confirmDeactivateTarget;
    if (!target) return;
    this.http.patch(`${environment.apiUrl}/api/users/${target.id}/deactivate`, {}).subscribe({
      next: () => {
        this.confirmDeactivateTarget = null;
        this.reload();
        this.showToast('success', 'Collaborateur désactivé');
      },
      error: (e) => {
        this.confirmDeactivateTarget = null;
        this.showToast('error', e?.error?.message || e?.error?.error || 'Désactivation impossible');
      },
    });
  }

  resetFilters(): void {
    this.search = '';
    this.roleFilter = 'ALL';
    this.departmentFilter = 'ALL';
    this.contractFilter = 'ALL';
    this.statusFilter = 'ALL';
    this.reload();
  }

  managerName(managerId?: number | null): string {
    if (!managerId) return '—';
    const m = this.employees.find((e) => e.id === managerId);
    return m ? `${m.prenom} ${m.nom}` : `#${managerId}`;
  }

  fullName(emp: EmployeeRow | null): string {
    return emp ? `${emp.prenom || ''} ${emp.nom || ''}`.trim() : '';
  }

  initials(emp: EmployeeRow | null): string {
    if (!emp) return 'RH';
    const first = emp.prenom?.trim()?.[0] || '';
    const last = emp.nom?.trim()?.[0] || '';
    return (first + last).toUpperCase() || 'RH';
  }

  roleLabel(role?: string | null): string {
    return role === 'MANAGER' ? 'Manager' : 'Employe';
  }

  statusLabel(emp: EmployeeRow): string {
    return emp.actif === false ? 'Inactif' : 'Actif';
  }

  avatarTone(emp: EmployeeRow): string {
    const tones = ['blue', 'purple', 'cyan', 'green', 'orange', 'red', 'slate'];
    return tones[Math.abs((emp.id || 0) % tones.length)];
  }

  fieldValue(value?: string | number | null): string {
    return value === null || value === undefined || value === '' ? '—' : String(value);
  }

  isStepDone(step: FormStep): boolean {
    return this.formStep > step;
  }

  private validateStep(): boolean {
    const form = this.drawerMode === 'edit' ? this.editForm : this.form;
    const controlsByStep: Record<FormStep, string[]> = {
      1: ['prenom', 'nom', 'email'],
      2: ['departement', 'role'],
      3: ['typeContrat'],
    };
    const controls = controlsByStep[this.formStep];
    controls.forEach((name) => form.get(name)?.markAsTouched());
    const valid = controls.every((name) => form.get(name)?.valid);
    this.formError = valid ? null : 'Veuillez compléter les champs obligatoires de cette étape.';
    return valid;
  }

  private today(): string {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
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
