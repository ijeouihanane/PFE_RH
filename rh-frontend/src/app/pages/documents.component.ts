import { DatePipe, DecimalPipe, NgClass, NgFor, NgIf } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { IIconComponent } from '../core/i-icon.component';
import { AuthService } from '../core/auth.service';
import { environment } from '../../environments/environment';

type DocStatus = 'EN_ATTENTE' | 'PRET' | 'REFUSE';
type DocType = 'ATTESTATION_TRAVAIL' | 'ATTESTATION_SALAIRE' | 'FICHE_PAIE' | 'ATTESTATION_CNSS' | 'AUTRE';

type DocumentRequest = {
  id: number;
  employeeId: number;
  typeDoc: DocType | string;
  statut: DocStatus;
  fichierUrl?: string | null;
  createdAt: string;
  processedAt?: string | null;
  processedBy?: number | null;
  mois?: number | null;
  annee?: number | null;
  commentaireDemande?: string | null;
  commentaire?: string | null;
};

@Component({
  standalone: true,
  selector: 'app-documents',
  imports: [NgIf, NgFor, NgClass, FormsModule, ReactiveFormsModule, DatePipe, DecimalPipe, IIconComponent],
  templateUrl: './documents.component.html',
  styleUrl: './documents.component.scss',
})
export class DocumentsComponent implements OnInit {
  readonly docTypes: { value: DocType; label: string }[] = [
    { value: 'ATTESTATION_TRAVAIL', label: 'Attestation de travail' },
    { value: 'ATTESTATION_SALAIRE', label: 'Attestation de salaire' },
    { value: 'FICHE_PAIE', label: 'Fiche de paie' },
    { value: 'ATTESTATION_CNSS', label: 'Attestation CNSS' },
    { value: 'AUTRE', label: 'Autre' },
  ];

  readonly months = Array.from({ length: 12 }, (_, i) => i + 1);
  readonly years = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - i);

  users: any[] = [];
  myRequests: DocumentRequest[] = [];
  allRequests: DocumentRequest[] = [];
  selectedRequest: DocumentRequest | null = null;
  selectedFile: File | null = null;
  refuseComment = '';
  showRequestModal = false;
  showRefuseModal = false;
  rhSearch = '';
  rhTypeFilter = 'ALL';
  rhStatusFilter = 'ALL';
  error: string | null = null;
  success: string | null = null;
  drawerError: string | null = null;
  isSubmitting = false;

  requestForm = this.fb.nonNullable.group({
    typeDoc: ['ATTESTATION_TRAVAIL' as DocType, Validators.required],
    mois: [new Date().getMonth() + 1],
    annee: [new Date().getFullYear()],
    commentaireDemande: [''],
  });

  constructor(
    readonly auth: AuthService,
    private readonly http: HttpClient,
    private readonly fb: FormBuilder,
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.error = null;
    if (this.isRh) {
      this.http.get<any[]>(`${environment.apiUrl}/api/users`).subscribe({
        next: users => this.users = users || [],
        error: () => this.users = [],
      });
      this.http.get<DocumentRequest[]>(`${environment.apiUrl}/api/documents/requests/all`).subscribe({
        next: items => this.allRequests = items || [],
        error: e => this.error = e?.error?.error ?? 'Impossible de charger les demandes.',
      });
    } else {
      this.http.get<DocumentRequest[]>(`${environment.apiUrl}/api/documents/requests/my`).subscribe({
        next: items => this.myRequests = items || [],
        error: e => this.error = e?.error?.error ?? 'Impossible de charger vos demandes.',
      });
    }
  }

  get isRh(): boolean {
    return this.auth.user?.role === 'RH';
  }

  get requests(): DocumentRequest[] {
    return this.isRh ? this.allRequests : this.myRequests;
  }

  get pendingCount(): number {
    return this.requests.filter(r => r.statut === 'EN_ATTENTE').length;
  }

  get readyCount(): number {
    return this.requests.filter(r => r.statut === 'PRET').length;
  }

  get refusedCount(): number {
    return this.requests.filter(r => r.statut === 'REFUSE').length;
  }

  get filteredRhRequests(): DocumentRequest[] {
    const q = this.rhSearch.trim().toLowerCase();
    return this.allRequests.filter(r => {
      const u = this.userById(r.employeeId);
      const employeeText = `${u?.prenom || ''} ${u?.nom || ''} ${u?.matricule || ''}`.toLowerCase();
      const matchesSearch = !q || employeeText.includes(q);
      const matchesType = this.rhTypeFilter === 'ALL' || r.typeDoc === this.rhTypeFilter;
      const matchesStatus = this.rhStatusFilter === 'ALL' || r.statut === this.rhStatusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }

  get isPayslipRequest(): boolean {
    return this.requestForm.controls.typeDoc.value === 'FICHE_PAIE';
  }

  get isOtherRequest(): boolean {
    return this.requestForm.controls.typeDoc.value === 'AUTRE';
  }

  openRequestModal(): void {
    this.success = null;
    this.error = null;
    this.showRequestModal = true;
  }

  closeRequestModal(): void {
    this.showRequestModal = false;
    this.requestForm.reset({
      typeDoc: 'ATTESTATION_TRAVAIL',
      mois: new Date().getMonth() + 1,
      annee: new Date().getFullYear(),
      commentaireDemande: '',
    });
  }

  submitRequest(): void {
    this.error = null;
    this.success = null;
    const raw = this.requestForm.getRawValue();
    if (raw.typeDoc === 'AUTRE' && !raw.commentaireDemande.trim()) {
      this.error = 'Le commentaire est obligatoire pour une demande Autre.';
      return;
    }
    const payload = {
      typeDoc: raw.typeDoc,
      mois: raw.typeDoc === 'FICHE_PAIE' ? raw.mois : null,
      annee: raw.typeDoc === 'FICHE_PAIE' ? raw.annee : null,
      commentaireDemande: raw.commentaireDemande.trim(),
    };
    this.isSubmitting = true;
    this.http.post(`${environment.apiUrl}/api/documents/requests`, payload).subscribe({
      next: () => {
        this.success = 'Demande envoyée au service RH.';
        this.isSubmitting = false;
        this.closeRequestModal();
        this.reload();
      },
      error: e => {
        this.error = e?.error?.error ?? "Erreur lors de l'envoi de la demande.";
        this.isSubmitting = false;
      },
    });
  }

  openDrawer(item: DocumentRequest): void {
    this.selectedRequest = item;
    this.selectedFile = null;
    this.refuseComment = '';
    this.drawerError = null;
  }

  closeDrawer(): void {
    this.selectedRequest = null;
    this.selectedFile = null;
    this.refuseComment = '';
    this.drawerError = null;
  }

  onDrawerFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] || null;
  }

  markReady(): void {
    if (!this.selectedRequest || !this.selectedFile) {
      this.drawerError = 'Veuillez choisir un fichier PDF.';
      return;
    }
    const fd = new FormData();
    fd.append('file', this.selectedFile);
    this.http.post(`${environment.apiUrl}/api/documents/requests/${this.selectedRequest.id}/complete`, fd).subscribe({
      next: () => {
        this.closeDrawer();
        this.reload();
      },
      error: e => this.drawerError = e?.error?.error ?? "Erreur lors de l'upload du document.",
    });
  }

  openRefuseModal(): void {
    this.drawerError = null;
    this.showRefuseModal = true;
  }

  closeRefuseModal(): void {
    this.showRefuseModal = false;
    this.refuseComment = '';
    this.drawerError = null;
  }

  confirmRefuse(): void {
    this.refuse();
  }

  refuse(): void {
    if (!this.selectedRequest) return;
    if (!this.refuseComment.trim()) {
      this.drawerError = 'Le motif de refus est obligatoire.';
      return;
    }
    this.http.post(`${environment.apiUrl}/api/documents/requests/${this.selectedRequest.id}/refuse`, {
      commentaire: this.refuseComment.trim(),
    }).subscribe({
      next: () => {
        this.closeRefuseModal();
        this.closeDrawer();
        this.reload();
      },
      error: e => this.drawerError = e?.error?.error ?? 'Erreur lors du refus.',
    });
  }

  userById(id: number): any | undefined {
    return this.users.find(u => u.id === id);
  }

  employeeName(id: number): string {
    const u = this.userById(id);
    return u ? `${u.prenom} ${u.nom}` : `Utilisateur #${id}`;
  }

  employeeMatricule(id: number): string {
    return this.userById(id)?.matricule || '—';
  }

  employeeDepartment(id: number): string {
    return this.userById(id)?.departement || '—';
  }

  typeLabel(type: string): string {
    return this.docTypes.find(t => t.value === type)?.label || type;
  }

  details(item: DocumentRequest): string {
    if (item.typeDoc === 'FICHE_PAIE' && item.mois && item.annee) {
      return `${String(item.mois).padStart(2, '0')}/${item.annee}`;
    }
    return item.commentaireDemande || '—';
  }

  reference(item: DocumentRequest): string {
    return `DOC-${new Date(item.createdAt).getFullYear() || new Date().getFullYear()}-${String(item.id).padStart(4, '0')}`;
  }

  statusLabel(status: DocStatus): string {
    if (status === 'EN_ATTENTE') return 'En attente';
    if (status === 'PRET') return 'Prêt';
    return 'Refusée';
  }

  statusIcon(status: DocStatus): string {
    if (status === 'PRET') return 'check-circle';
    if (status === 'REFUSE') return 'x-circle';
    return 'clock';
  }

  fileUrl(path?: string | null): string {
    if (!path) return '#';
    return path.startsWith('http') ? path : `${environment.apiUrl}${path}`;
  }

  fileName(path?: string | null): string {
    if (!path) return 'document.pdf';
    return decodeURIComponent(path.split('/').pop() || 'document.pdf');
  }
}
