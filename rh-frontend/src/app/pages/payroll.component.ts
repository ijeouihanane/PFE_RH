import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgFor, NgIf, DecimalPipe, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { environment } from '../../environments/environment';
import { Subscription, of } from 'rxjs';
import { debounceTime, switchMap, catchError, filter, map } from 'rxjs/operators';

// Interface locale pour une ligne du tableau de traitement mensuel
interface BatchRow {
  employeeId: number;
  matricule: string;
  employeeName: string;
  hasProfile: boolean;
  baseSalary: number;
  fixedBonus: number;
  transport: number;
  panier: number;
  bonus: number;
  indemnite: number;
  retenue: number;
  motif: string;
  netPay: number | null;
  selected: boolean;
  generable: boolean;
  pdfUrl: string | null;
  status: string | null;
  rowError: string | null;  // erreur de génération pour cette ligne
}

@Component({
  standalone: true,
  selector: 'app-payroll',
  imports: [NgIf, NgFor, ReactiveFormsModule, FormsModule, DecimalPipe, DatePipe],
  templateUrl: './payroll.component.html',
  styleUrls: ['./payroll.component.scss'],
})
export class PayrollComponent implements OnInit, OnDestroy {


  // Onglets : 0=Traitement mensuel, 1=Générer bulletin, 2=Données de paie, 3=Paramètres, 4=Historique
  readonly tabs = ['Traitement mensuel', 'Générer bulletin', 'Données de paie', 'Paramètres', 'Historique'];
  activeTab = 0; // Par défaut : Traitement mensuel

  employees: any[] = [];

  // --- Traitement mensuel (onglet 0) ---
  batchMois: number = new Date().getMonth() + 1;
  batchAnnee: number = new Date().getFullYear();
  batchRows: BatchRow[] = [];
  batchLoading = false;
  batchGenerating = false;
  batchGenerateError: string | null = null;

  readonly monthOptions = [
    { value: 1, label: 'Janvier' }, { value: 2, label: 'Février' },
    { value: 3, label: 'Mars' }, { value: 4, label: 'Avril' },
    { value: 5, label: 'Mai' }, { value: 6, label: 'Juin' },
    { value: 7, label: 'Juillet' }, { value: 8, label: 'Août' },
    { value: 9, label: 'Septembre' }, { value: 10, label: 'Octobre' },
    { value: 11, label: 'Novembre' }, { value: 12, label: 'Décembre' },
  ];

  monthLabel(mois: number): string {
    return this.monthOptions.find(m => m.value === mois)?.label ?? '';
  }

  setActiveTab(index: number): void {
    this.activeTab = index;
    if (index === 4 && this.historyList.length === 0 && !this.historyLoading) {
      this.loadHistory();
    }
  }

  // --- Simulation (onglet 1 : Générer bulletin) ---

  simForm = this.fb.nonNullable.group({
    employeeId: [0, Validators.min(1)],
    mois: [new Date().getMonth() + 1, [Validators.required, Validators.min(1), Validators.max(12)]],
    annee: [new Date().getFullYear(), [Validators.required, Validators.min(2000)]],
    primeTransport: [0],
    primePanier: [0],
    bonus: [0],
    indemnite: [0],
    // Tâche 1 — Retenue spécifique
    retenueSpecifique: [0],
    motifRetenue: [''],
  });

  simError: string | null = null;
  simProfileLoaded = false;
  simProfileBaseSalary = 0;
  simProfileFixedBonus = 0;
  simEmployee: any = null;
  simResult: any = null;
  isSimulating = false;
  private simSub: Subscription | null = null;

  // Validation retenue
  retenueMotifError: string | null = null;

  // --- Lot 3 : Sauvegarde DRAFT ---
  isSaving = false;
  saveError: string | null = null;
  savedDraftId: number | null = null;

  // --- Lot 3 : Historique ---
  historyEmployeeId = 0;
  historyMois: number = new Date().getMonth() + 1;
  historyAnnee: number = new Date().getFullYear();
  historySearch = '';
  historyList: any[] = [];
  historyLoading = false;
  historyError: string | null = null;

  // --- Lot 4 : Validation + PDF ---
  isValidated = false;
  isPdfGenerating = false;
  pdfError: string | null = null;
  validatedPdfUrl: string | null = null;
  readonly apiUrl = environment.apiUrl;

  // --- Lot 5 : Envoi ---
  isSent = false;
  isSending = false;
  sendError: string | null = null;

  // --- Données de paie (onglet 2) ---
  profileEmployeeSelect = this.fb.control(0);
  profileForm = this.fb.nonNullable.group({
    baseSalary: [0, [Validators.required, Validators.min(0.01)]],
    fixedBonus: [0],
    active: [true],
  });
  profileLoaded = false;
  profileNotFound = false;
  profileError: string | null = null;
  profileSuccess: string | null = null;

  // --- Paramètres (onglet 3) ---
  parameters: any[] = [];
  paramError: string | null = null;
  paramSuccess: string | null = null;

  taxBrackets: any[] = [];
  bracketError: string | null = null;
  bracketSuccess: string | null = null;

  seniorityRules: any[] = [];
  seniorityError: string | null = null;
  senioritySuccess: string | null = null;

  // ===== Toast notifications =====
  toast: { message: string; sub?: string; type: 'success' | 'error'; link?: string } | null = null;
  private toastTimer: any = null;

  showToast(message: string, type: 'success' | 'error' = 'success', sub?: string, link?: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast = { message, type, sub, link };
    this.toastTimer = setTimeout(() => { this.toast = null; }, 4000);
  }

  dismissToast(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast = null;
  }

  constructor(
    private readonly http: HttpClient,
    private readonly fb: FormBuilder,
  ) { }

  ngOnInit(): void {
    this.http.get<any[]>(`${environment.apiUrl}/api/users`).subscribe((rows) => {
      this.employees = rows.filter((e: any) => e.actif && (e.role === 'EMPLOYEE' || e.role === 'MANAGER'));
      // Chargement automatique du tableau du mois courant dès l'ouverture
      this.prepareBatch();
    });
    this.loadParameters();
    this.loadTaxBrackets();
    this.loadSeniorityRules();
    this.setupSimulation();
  }

  ngOnDestroy(): void {
    if (this.simSub) {
      this.simSub.unsubscribe();
    }
  }

  // ===== Simulation =====

  onSimEmployeeChange(): void {
    const empId = +(this.simForm.value.employeeId ?? 0);
    if (!empId) return;

    this.simError = null;
    this.saveError = null;
    this.pdfError = null;
    this.sendError = null;
    this.retenueMotifError = null;
    this.savedDraftId = null;
    this.isValidated = false;
    this.validatedPdfUrl = null;
    this.isSent = false;
    this.isSending = false;
    this.simProfileLoaded = false;
    this.simResult = null;
    this.simEmployee = this.employees.find(e => e.id === empId);

    this.http.get<any>(`${environment.apiUrl}/api/payroll/profiles/${empId}`).subscribe({
      next: (p) => {
        if (!p.active) {
          this.simError = "Le profil de cet employé est inactif. Simulation impossible.";
          return;
        }
        this.simProfileBaseSalary = p.baseSalary;
        this.simProfileFixedBonus = p.fixedBonus || 0;
        this.simProfileLoaded = true;

        this.simForm.patchValue({
          primeTransport: 0, primePanier: 0, bonus: 0, indemnite: 0,
          retenueSpecifique: 0, motifRetenue: ''
        }, { emitEvent: true });
      },
      error: () => {
        this.simError = "Aucun profil paie trouvé pour cet employé. Veuillez le configurer dans l'onglet 'Données de paie'.";
        this.simProfileLoaded = false;
        this.simResult = null;
      }
    });
  }

  private setupSimulation(): void {
    this.simSub = this.simForm.valueChanges.pipe(
      debounceTime(300),
      filter(val => this.simProfileLoaded && this.simForm.valid && this.simEmployee?.id === +(val.employeeId ?? 0)),
      switchMap(val => {
        this.isSimulating = true;
        this.retenueMotifError = null;

        const variables = [];
        if (val.primeTransport) variables.push({ code: 'PRIME_TRANSPORT', amount: val.primeTransport });
        if (val.primePanier) variables.push({ code: 'PRIME_PANIER', amount: val.primePanier });
        if (val.bonus) variables.push({ code: 'BONUS', amount: val.bonus });
        if (val.indemnite) variables.push({ code: 'INDEMNITE', amount: val.indemnite });

        // Tâche 1 — Retenue spécifique
        const retenueSpecifique = val.retenueSpecifique ?? 0;
        const motifRetenue = val.motifRetenue ?? '';

        // Validation frontend légère (ne bloque pas la simulation en preview)
        if (retenueSpecifique > 0 && !motifRetenue.trim()) {
          this.retenueMotifError = 'Le motif est obligatoire quand une retenue spécifique est saisie.';
          this.isSimulating = false;
          return of(null);
        }

        const request = {
          employeeId: +(val.employeeId ?? 0),
          mois: val.mois,
          annee: val.annee,
          dateEmbauche: this.simEmployee?.dateEmbauche,
          variables,
          retenueSpecifique: retenueSpecifique || 0,
          motifRetenue: motifRetenue || '',
        };

        return this.http.post<any>(`${environment.apiUrl}/api/payroll/payslips/simulate`, request).pipe(
          map(res => ({ reqEmployeeId: +(val.employeeId ?? 0), data: res })),
          catchError(err => {
            if (this.simEmployee?.id === +(val.employeeId ?? 0)) {
              this.simError = err?.error?.error || "Erreur lors de la simulation.";
            }
            this.isSimulating = false;
            return of(null);
          })
        );
      })
    ).subscribe(res => {
      this.isSimulating = false;
      if (res && this.simEmployee?.id === res.reqEmployeeId) {
        this.simResult = res.data;
        this.simError = null;
      }
    });
  }

  // ===== Données de paie (onglet 2) =====

  onProfileEmployeeChange(): void {
    const empId = +(this.profileEmployeeSelect.value ?? 0);
    if (!empId) return;
    this.profileError = null;
    this.profileSuccess = null;
    this.profileNotFound = false;
    this.profileLoaded = false;

    this.http.get<any>(`${environment.apiUrl}/api/payroll/profiles/${empId}`).subscribe({
      next: (p) => {
        this.profileForm.patchValue({
          baseSalary: p.baseSalary,
          fixedBonus: p.fixedBonus || 0,
          active: p.active,
        });
        this.profileLoaded = true;
      },
      error: (e) => {
        if (e.status === 404) {
          this.profileForm.reset({ baseSalary: 0, fixedBonus: 0, active: true });
          this.profileLoaded = true;
          this.profileNotFound = true;
        } else {
          this.profileError = 'Erreur lors du chargement du profil.';
        }
      },
    });
  }

  saveProfile(): void {
    this.profileError = null;
    this.profileSuccess = null;
    const empId = +(this.profileEmployeeSelect.value ?? 0);
    if (!empId) {
      this.profileError = 'Veuillez sélectionner un employé.';
      return;
    }
    if (this.profileForm.invalid) {
      this.profileError = 'Le salaire de base est obligatoire.';
      return;
    }
    const v = this.profileForm.getRawValue();
    this.http.put<any>(`${environment.apiUrl}/api/payroll/profiles/${empId}`, {
      baseSalary: v.baseSalary,
      fixedBonus: v.fixedBonus,
      active: true,
    }).subscribe({
      next: () => {
        this.showToast('Profil paie enregistré', 'success', 'Les données de paie ont été sauvegardées.');
        this.profileNotFound = false;
      },
      error: (e) => {
        this.profileError = e?.error?.error ?? 'Erreur lors de la sauvegarde.';
      },
    });
  }

  // ===== Paramètres (onglet 3) =====

  loadParameters(): void {
    this.http.get<any[]>(`${environment.apiUrl}/api/payroll/parameters`).subscribe({
      next: (p) => this.parameters = p,
      error: () => this.paramError = 'Erreur de chargement des paramètres.',
    });
  }

  saveParameters(): void {
    this.paramError = null;
    this.paramSuccess = null;
    this.http.put<any[]>(`${environment.apiUrl}/api/payroll/parameters`, this.parameters).subscribe({
      next: (p) => {
        this.parameters = p;
        this.showToast('Paramètres enregistrés', 'success', 'Les taux et plafonds ont été mis à jour.');
      },
      error: (e) => this.paramError = e?.error?.error ?? 'Erreur de sauvegarde.',
    });
  }

  loadTaxBrackets(): void {
    this.http.get<any[]>(`${environment.apiUrl}/api/payroll/tax-brackets`).subscribe({
      next: (b) => this.taxBrackets = b,
      error: () => this.bracketError = 'Erreur de chargement des tranches IR.',
    });
  }

  saveTaxBrackets(): void {
    this.bracketError = null;
    this.bracketSuccess = null;
    this.http.put<any[]>(`${environment.apiUrl}/api/payroll/tax-brackets`, this.taxBrackets).subscribe({
      next: (b) => {
        this.taxBrackets = b;
        this.showToast('Tranches IR enregistrées', 'success', 'Le barème IR a été mis à jour.');
      },
      error: (e) => this.bracketError = e?.error?.error ?? 'Erreur de sauvegarde.',
    });
  }

  loadSeniorityRules(): void {
    this.http.get<any[]>(`${environment.apiUrl}/api/payroll/seniority-rules`).subscribe({
      next: (r) => this.seniorityRules = r,
      error: () => this.seniorityError = 'Erreur de chargement des règles.',
    });
  }

  saveSeniorityRules(): void {
    this.seniorityError = null;
    this.senioritySuccess = null;
    this.http.put<any[]>(`${environment.apiUrl}/api/payroll/seniority-rules`, this.seniorityRules).subscribe({
      next: (r) => {
        this.seniorityRules = r;
        this.showToast('Règles d\'ancienneté enregistrées', 'success', 'Le barème d\'ancienneté a été mis à jour.');
      },
      error: (e) => this.seniorityError = e?.error?.error ?? 'Erreur de sauvegarde.',
    });
  }

  // ===== Lot 4 : Télécharger PDF =====

  downloadPdf(): void {
    if (!this.simResult) return;
    this.pdfError = null;

    if (this.isValidated && this.validatedPdfUrl) {
      window.open(this.apiUrl + this.validatedPdfUrl, '_blank');
      return;
    }

    // Validation retenue avant génération
    const val = this.simForm.value;
    const retenueSpecifique = val.retenueSpecifique ?? 0;
    const motifRetenue = val.motifRetenue ?? '';
    if (retenueSpecifique > 0 && !motifRetenue.trim()) {
      this.pdfError = 'Le motif est obligatoire quand une retenue spécifique est saisie.';
      return;
    }

    this.isPdfGenerating = true;
    const saveAndValidate = () => {
      const variables: any[] = [];
      if (val.primeTransport) variables.push({ code: 'PRIME_TRANSPORT', amount: val.primeTransport });
      if (val.primePanier) variables.push({ code: 'PRIME_PANIER', amount: val.primePanier });
      if (val.bonus) variables.push({ code: 'BONUS', amount: val.bonus });
      if (val.indemnite) variables.push({ code: 'INDEMNITE', amount: val.indemnite });

      const req = {
        employeeId: +(val.employeeId ?? 0),
        mois: val.mois,
        annee: val.annee,
        employeeFirstName: this.simEmployee.prenom,
        employeeLastName: this.simEmployee.nom,
        employeeMatricule: this.simEmployee.matricule,
        employeePoste: this.simEmployee.poste,
        employeeDepartement: this.simEmployee.departement,
        employeeCnss: this.simEmployee.cnss,
        employeeRib: this.simEmployee.rib,
        employeeBankName: this.simEmployee.nomBanque,
        employeeHireDate: this.simEmployee.dateEmbauche,
        variables,
        retenueSpecifique: retenueSpecifique || 0,
        motifRetenue: motifRetenue || '',
      };

      this.http.post<any>(`${this.apiUrl}/api/payroll/payslips`, req).subscribe({
        next: (draftRes) => {
          const draftId = draftRes.id;
          this.savedDraftId = draftId;

          this.http.post<any>(`${this.apiUrl}/api/payroll/payslips/${draftId}/validate`, {}).subscribe({
            next: (validated) => {
              this.isPdfGenerating = false;
              this.isValidated = true;
              this.validatedPdfUrl = validated.pdfUrl;
              this.savedDraftId = validated.id;
              if (this.historyEmployeeId !== req.employeeId) {
                this.historyEmployeeId = req.employeeId;
              }
              this.loadHistory();
              if (validated.pdfUrl) {
                window.open(this.apiUrl + validated.pdfUrl, '_blank');
              }
            },
            error: (err) => {
              this.isPdfGenerating = false;
              if (err.status === 409 && (this.isValidated || this.validatedPdfUrl)) {
                this.pdfError = null;
              } else {
                this.pdfError = err?.error?.error ?? 'Erreur lors de la validation/génération du PDF.';
              }
            }
          });
        },
        error: (err) => {
          this.isPdfGenerating = false;
          if (err.status === 409 && (this.isValidated || this.validatedPdfUrl)) {
            this.pdfError = null;
          } else {
            this.pdfError = err?.error?.error ?? 'Erreur lors de la sauvegarde avant validation.';
          }
        }
      });
    };
    saveAndValidate();
  }

  // ===== Lot 5 : Envoyer bulletin =====

  sendPayslip(): void {
    if (!this.savedDraftId || !this.isValidated || this.isSent) return;
    this.sendError = null;
    this.isSending = true;
    this.http.post<any>(`${this.apiUrl}/api/payroll/payslips/${this.savedDraftId}/send`, {}).subscribe({
      next: () => {
        this.isSending = false;
        this.isSent = true;
        this.loadHistory();
      },
      error: (err) => {
        this.isSending = false;
        this.sendError = err?.error?.error ?? "Erreur lors de l'envoi du bulletin.";
      }
    });
  }

  sendPayslipFromHistory(h: any): void {
    this.http.post<any>(`${this.apiUrl}/api/payroll/payslips/${h.id}/send`, {}).subscribe({
      next: (updated) => {
        h.status = updated.status;
        if (this.savedDraftId === h.id) {
          this.isSent = true;
        }
      },
      error: (err) => {
        this.historyError = err?.error?.error ?? "Erreur lors de l'envoi.";
      }
    });
  }

  // ===== Lot 3 : Sauvegarde DRAFT =====

  saveDraft(): void {
    if (!this.simForm.valid || !this.simProfileLoaded || !this.simEmployee || !this.simResult) return;

    const val = this.simForm.value;
    const retenueSpecifique = val.retenueSpecifique ?? 0;
    const motifRetenue = val.motifRetenue ?? '';

    if (retenueSpecifique > 0 && !motifRetenue.trim()) {
      this.saveError = 'Le motif est obligatoire quand une retenue spécifique est saisie.';
      return;
    }

    this.isSaving = true;
    this.saveError = null;
    this.savedDraftId = null;

    const variables: any[] = [];
    if (val.primeTransport) variables.push({ code: 'PRIME_TRANSPORT', amount: val.primeTransport });
    if (val.primePanier) variables.push({ code: 'PRIME_PANIER', amount: val.primePanier });
    if (val.bonus) variables.push({ code: 'BONUS', amount: val.bonus });
    if (val.indemnite) variables.push({ code: 'INDEMNITE', amount: val.indemnite });

    const req = {
      employeeId: +(val.employeeId ?? 0),
      mois: val.mois,
      annee: val.annee,
      employeeFirstName: this.simEmployee.prenom,
      employeeLastName: this.simEmployee.nom,
      employeeMatricule: this.simEmployee.matricule,
      employeePoste: this.simEmployee.poste,
      employeeDepartement: this.simEmployee.departement,
      employeeCnss: this.simEmployee.cnss,
      employeeRib: this.simEmployee.rib,
      employeeBankName: this.simEmployee.nomBanque,
      employeeHireDate: this.simEmployee.dateEmbauche,
      variables,
      retenueSpecifique: retenueSpecifique || 0,
      motifRetenue: motifRetenue || '',
    };

    this.http.post<any>(`${environment.apiUrl}/api/payroll/payslips`, req).subscribe({
      next: (res) => {
        this.isSaving = false;
        this.savedDraftId = res.id;
        this.showToast('Bulletin sauvegardé', 'success', 'Le brouillon a bien été enregistré.', 'draft');
        if (this.historyMois === req.mois && this.historyAnnee === req.annee) {
          this.loadHistory();
        }
      },
      error: (err) => {
        this.isSaving = false;
        this.saveError = err?.error?.error ?? 'Erreur lors de la sauvegarde du brouillon.';
      }
    });
  }

  // ===== Lot 3 : Historique =====

  loadHistory(): void {
    this.historyLoading = true;
    this.historyError = null;

    this.http.get<any[]>(`${environment.apiUrl}/api/payroll/payslips/history?mois=${this.historyMois}&annee=${this.historyAnnee}`).subscribe({
      next: (list) => {
        this.historyList = list;
        this.historyLoading = false;
      },
      error: () => {
        this.historyError = 'Erreur lors du chargement de l\'historique.';
        this.historyLoading = false;
        this.historyList = [];
      }
    });
  }

  get filteredHistoryList(): any[] {
    const q = this.historySearch.trim().toLowerCase();
    if (!q) {
      return this.historyList;
    }
    return this.historyList.filter(h => {
      const fullName = `${h.employeeFirstName || ''} ${h.employeeLastName || ''}`.toLowerCase();
      const matricule = `${h.employeeMatricule || ''}`.toLowerCase();
      const status = `${h.status || ''}`.toLowerCase();
      return fullName.includes(q) || matricule.includes(q) || status.includes(q);
    });
  }

  loadDraftIntoForm(payslip: any): void {
    if (payslip.status !== 'DRAFT') return;

    this.http.get<any>(`${environment.apiUrl}/api/payroll/payslips/${payslip.id}`).subscribe({
      next: (fullPayslip) => {
        this.activeTab = 1; // Basculer vers onglet Générer bulletin (index 1)

        this.simForm.patchValue({ employeeId: fullPayslip.employeeId }, { emitEvent: false });
        this.onSimEmployeeChange();

        // Attendre que le profil soit chargé avant de patcher les variables
        setTimeout(() => {
          let primeTransport = 0, primePanier = 0, bonus = 0, indemnite = 0;
          let retenueSpecifique = 0, motifRetenue = '';

          fullPayslip.lines?.forEach((l: any) => {
            if (l.manual && l.type === 'GAIN') {
              if (l.label === 'Prime transport') primeTransport = l.amount;
              if (l.label === 'Prime panier') primePanier = l.amount;
              if (l.label === 'Bonus') bonus = l.amount;
              if (l.label === 'Indemnité') indemnite = l.amount;
            }
            // Tâche 1 — Recharger retenue spécifique depuis le DRAFT
            if (l.manual && l.type === 'DEDUCTION' && l.code === 'RETENUE_SPECIFIQUE') {
              retenueSpecifique = l.amount;
              // Extraire le motif depuis "Retenue spécifique - {motif}"
              const prefix = 'Retenue spécifique - ';
              motifRetenue = l.label?.startsWith(prefix)
                ? l.label.substring(prefix.length)
                : (l.label || '');
            }
          });

          this.simForm.patchValue({
            mois: fullPayslip.mois,
            annee: fullPayslip.annee,
            primeTransport,
            primePanier,
            bonus,
            indemnite,
            retenueSpecifique,
            motifRetenue,
          });
        }, 500);
      },
      error: () => {
        this.historyError = 'Erreur lors du chargement des détails du brouillon.';
      }
    });
  }

  // ===== Traitement mensuel — Tâche 3 : Simulation groupée =====

  /** Prépare la période avec de vraies données depuis le backend (sans sauvegarder). */
  prepareBatch(): void {
    if (this.employees.length === 0) {
      // Les employés ne sont pas encore chargés ? on re-tente après un petit délai
      setTimeout(() => this.prepareBatch(), 500);
      return;
    }

    this.batchLoading = true;
    this.batchGenerating = false;

    // Construire le payload de la requête
    const requestRows = this.employees.map(emp => ({
      employeeId: emp.id,
      employeeFirstName: emp.prenom,
      employeeLastName: emp.nom,
      employeeMatricule: emp.matricule,
      employeePoste: emp.poste,
      employeeDepartement: emp.departement,
      employeeCnss: emp.cnss,
      employeeRib: emp.rib,
      employeeBankName: emp.nomBanque,
      employeeHireDate: emp.dateEmbauche,
      variables: [], // Au premier chargement, variables vides
      retenueSpecifique: 0,
      motifRetenue: ''
    }));

    const payload = {
      mois: this.batchMois,
      annee: this.batchAnnee,
      rows: requestRows
    };

    this.http.post<any>(`${environment.apiUrl}/api/payroll/payslips/batch/simulate`, payload).subscribe({
      next: (res) => {
        // Mapper la réponse sur notre interface locale BatchRow
        this.batchRows = res.rows.map((r: any) => {
          const emp = this.employees.find(e => e.id === r.employeeId);
          let name = emp ? `${emp.prenom || ''} ${emp.nom || ''}`.trim() : '';
          if (!name && emp?.matricule) name = emp.matricule;
          if (!name) name = `Employé #${r.employeeId}`;

          return {
            employeeId: r.employeeId,
            matricule: emp?.matricule || '',
            employeeName: name,
            hasProfile: r.hasProfile,
            baseSalary: r.baseSalary || 0,
            fixedBonus: r.fixedBonus || 0,
            transport: r.transport || 0,
            panier: r.panier || 0,
            bonus: r.bonus || 0,
            indemnite: r.indemnite || 0,
            retenue: r.retenueSpecifique || 0,
            motif: r.motifRetenue || '',
            netPay: r.netPay,
            status: r.status,
            generable: r.generable,
            pdfUrl: r.pdfUrl,
            selected: false, // Coche par défaut si générable
            rowError: null,
          };
        });
        this.batchLoading = false;
      },
      error: (err) => {
        console.error('Erreur lors de la préparation batch', err);
        this.batchLoading = false;
      }
    });
  }

  // Stocke les timers de debounce pour éviter de noyer le backend
  private debounceTimers: { [employeeId: number]: any } = {};

  /**
   * Appelé quand une variable ou retenue est modifiée sur une ligne générable.
   * Recalcule uniquement cette ligne avec le backend.
   */
  onBatchRowChange(row: BatchRow): void {
    if (!row.generable) return;

    // Si retenue > 0 mais pas de motif, on bloque le recalcul et on marque visuellement une erreur (via CSS ngModel)
    if (row.retenue > 0 && !row.motif) {
      return; // Ne pas appeler le backend, l'erreur est visible sur la ligne
    }

    // Debounce
    if (this.debounceTimers[row.employeeId]) {
      clearTimeout(this.debounceTimers[row.employeeId]);
    }

    this.debounceTimers[row.employeeId] = setTimeout(() => {
      this.recalculateSingleBatchRow(row);
    }, 400); // 400ms delay
  }

  private recalculateSingleBatchRow(row: BatchRow): void {
    const emp = this.employees.find(e => e.id === row.employeeId);
    if (!emp) return;

    // Construire les variables
    const vars = [];
    if (row.transport > 0) vars.push({ code: 'PRIME_TRANSPORT', amount: row.transport });
    if (row.panier > 0) vars.push({ code: 'PRIME_PANIER', amount: row.panier });
    if (row.bonus > 0) vars.push({ code: 'BONUS', amount: row.bonus });
    if (row.indemnite > 0) vars.push({ code: 'INDEMNITE', amount: row.indemnite });

    const payload = {
      mois: this.batchMois,
      annee: this.batchAnnee,
      rows: [{
        employeeId: emp.id,
        employeeFirstName: emp.prenom,
        employeeLastName: emp.nom,
        employeeMatricule: emp.matricule,
        employeePoste: emp.poste,
        employeeDepartement: emp.departement,
        employeeCnss: emp.cnss,
        employeeRib: emp.rib,
        employeeBankName: emp.nomBanque,
        employeeHireDate: emp.dateEmbauche,
        variables: vars,
        retenueSpecifique: row.retenue || 0,
        motifRetenue: row.motif || '',
        recalculation: true
      }]
    };

    // On utilise le même endpoint de simulation groupée, mais avec une seule ligne
    this.http.post<any>(`${environment.apiUrl}/api/payroll/payslips/batch/simulate`, payload).subscribe({
      next: (res) => {
        if (res.rows && res.rows.length > 0) {
          const updated = res.rows[0];
          // On met à jour le Net et autres valeurs retournées
          row.netPay = updated.netPay;
          row.baseSalary = updated.baseSalary || row.baseSalary;
          row.fixedBonus = updated.fixedBonus || row.fixedBonus;
          // on ne touche pas à generable / selected
        }
      },
      error: (err) => console.error(`Erreur recalcul employé ${row.employeeId}`, err)
    });
  }

  get batchSelectedCount(): number {
    return this.batchRows.filter(r => r.selected).length;
  }

  get batchAllChecked(): boolean {
    const generables = this.batchRows.filter(r => r.generable);
    return generables.length > 0 && generables.every(r => r.selected);
  }

  toggleAllBatch(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.batchRows.filter(r => r.generable).forEach(r => r.selected = checked);
  }

  /** Remet à zéro les variables saisies sur les lignes générables uniquement. */
  resetBatchVariables(): void {
    this.batchRows.filter(r => r.generable).forEach(r => {
      r.transport = 0;
      r.panier = 0;
      r.bonus = 0;
      r.indemnite = 0;
      r.retenue = 0;
      r.motif = '';
      r.rowError = null;
      this.onBatchRowChange(r); // Relance le recalcul à 0
    });
  }

  /**
   * Génère les bulletins des lignes cochées et générables.
   * Envoie uniquement les lignes sélectionnées au backend.
   * Met à jour chaque ligne en fonction du résultat reçu.
   */
  generateBatch(): void {
    this.batchGenerateError = null;

    // Filtrer les lignes à générer : cochées + générables
    const toGenerate = this.batchRows.filter(r => r.selected && r.generable);

    if (toGenerate.length === 0) return;

    // Validation locale : retenue > 0 sans motif
    let hasLocalError = false;
    toGenerate.forEach(r => {
      if (r.retenue > 0 && !r.motif?.trim()) {
        r.rowError = 'Motif obligatoire pour la retenue';
        hasLocalError = true;
      } else {
        r.rowError = null;
      }
    });
    if (hasLocalError) return;

    // Construire le payload
    const payload = {
      mois: this.batchMois,
      annee: this.batchAnnee,
      rows: toGenerate.map(r => {
        const emp = this.employees.find(e => e.id === r.employeeId);
        return {
          employeeId: r.employeeId,
          employeeFirstName: emp?.prenom ?? '',
          employeeLastName: emp?.nom ?? '',
          employeeMatricule: emp?.matricule ?? '',
          employeePoste: emp?.poste ?? '',
          employeeDepartement: emp?.departement ?? '',
          employeeCnss: emp?.cnss ?? '',
          employeeRib: emp?.rib ?? '',
          employeeBankName: emp?.nomBanque ?? '',
          employeeHireDate: emp?.dateEmbauche ?? null,
          transport: r.transport || 0,
          panier: r.panier || 0,
          bonus: r.bonus || 0,
          indemnite: r.indemnite || 0,
          retenueSpecifique: r.retenue || 0,
          motifRetenue: r.motif || '',
        };
      })
    };

    this.batchGenerating = true;

    this.http.post<any>(`${environment.apiUrl}/api/payroll/payslips/batch/generate`, payload).subscribe({
      next: (res) => {
        this.batchGenerating = false;
        if (!res.results) return;

        res.results.forEach((result: any) => {
          const row = this.batchRows.find(r => r.employeeId === result.employeeId);
          if (!row) return;

          if (result.success) {
            // Mettre à jour la ligne avec le résultat
            row.status = result.status ?? 'VALIDATED';
            row.pdfUrl = result.pdfUrl ?? null;
            row.netPay = result.netPay ?? row.netPay;
            row.generable = false;  // plus modifiable
            row.selected = false;
            row.rowError = null;
          } else {
            row.rowError = result.error ?? 'Erreur de génération';
          }
        });
      },
      error: (err) => {
        this.batchGenerating = false;
        this.batchGenerateError = err?.error?.error ?? 'Erreur lors de la génération des bulletins.';
      }
    });
  }
}
