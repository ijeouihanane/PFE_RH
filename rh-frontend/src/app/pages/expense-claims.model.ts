export type ExpenseClaimStatus = 'SOUMIS' | 'APPROUVE' | 'REFUSE' | 'REMBOURSE';
export type ExpenseClaimCategory = 'TRANSPORT' | 'REPAS' | 'HEBERGEMENT' | 'CARBURANT' | 'MATERIEL' | 'TELEPHONE' | 'AUTRE';
export type ReimbursementMode = 'ESPECES' | 'VIREMENT' | 'AUTRE';

export interface ExpenseClaim {
  id: number;
  employeeId: number;
  employeeFirstName?: string | null;
  employeeLastName?: string | null;
  employeeLabel: string;
  employeeInitials: string;
  motif: string;
  categorie: ExpenseClaimCategory;
  montant: number;
  dateHeure: string;
  note?: string | null;
  justificatifUrl: string;
  justificatifOriginalName: string;
  status: ExpenseClaimStatus;
  refusalReason?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
  reviewedBy?: number | null;
  reimbursementMode?: ReimbursementMode | null;
  reimbursedAt?: string | null;
  reimbursementNote?: string | null;
  reimbursementProofUrl?: string | null;
  reimbursementProofOriginalName?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface ExpenseClaimSummary {
  totalSubmitted: number;
  pendingAmount: number;
  approvedAmount: number;
  reimbursedAmount: number;
  pendingCount: number;
  requestCount: number;
}

export const expenseClaimCategories: { value: ExpenseClaimCategory; label: string }[] = [
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'REPAS', label: 'Repas' },
  { value: 'HEBERGEMENT', label: 'Hébergement' },
  { value: 'CARBURANT', label: 'Carburant' },
  { value: 'MATERIEL', label: 'Matériel' },
  { value: 'TELEPHONE', label: 'Téléphone' },
  { value: 'AUTRE', label: 'Autre' },
];

export const expenseClaimStatuses: { value: ExpenseClaimStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Tous les statuts' },
  { value: 'SOUMIS', label: 'Soumis' },
  { value: 'APPROUVE', label: 'Approuvé' },
  { value: 'REFUSE', label: 'Refusé' },
  { value: 'REMBOURSE', label: 'Remboursé' },
];
