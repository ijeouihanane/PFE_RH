export type AppraisalStatus = 'BROUILLON' | 'SOUMIS' | 'PRISE_CONNAISSANCE' | 'VALIDEE_RH';
export type CriterionLevel = 'A_RENFORCER' | 'EN_PROGRESSION' | 'CONFORME' | 'POINT_FORT';
export type Performance = 'A_RENFORCER' | 'CONFORME' | 'SUPERIEURE';
export type Potential = 'A_CONFIRMER' | 'EVOLUTIF' | 'FORT';

export interface AppraisalCriterion {
  id: number;
  label: string;
  description: string;
  displayOrder: number;
}

export interface AppraisalAnswer {
  criterionId: number;
  criterionLabel: string;
  criterionDescription: string;
  displayOrder: number;
  level: CriterionLevel;
  comment?: string | null;
}

export interface PreviousAppraisal {
  periode: string;
  positioningCategory?: string | null;
  performance?: Performance | null;
}

export interface AppraisalContext {
  employee: any;
  anciennete: string;
  gridTemplateId: number;
  gridCode: string;
  gridLabel: string;
  criteria: AppraisalCriterion[];
  previousAppraisal?: PreviousAppraisal | null;
  defaultPeriod: string;
}

export interface Appraisal {
  id: number;
  employeeId: number;
  managerId: number;
  employeeName: string;
  managerName: string;
  employeeDepartment?: string | null;
  employeePoste?: string | null;
  periode: string;
  gridTemplateId?: number | null;
  gridLabel?: string | null;
  performance?: Performance | null;
  potential?: Potential | null;
  positioningCategory?: string | null;
  generatedSummary?: string | null;
  managerComment?: string | null;
  employeeComment?: string | null;
  statut: AppraisalStatus;
  createdAt: string;
  updatedAt?: string | null;
  submittedAt?: string | null;
  employeeAcknowledgedAt?: string | null;
  rhValidatedAt?: string | null;
  answers: AppraisalAnswer[];
}

export interface DraftPayload {
  employeeId: number;
  periode: string;
  performance: Performance | null;
  potential: Potential | null;
  generatedSummary: string | null;
  managerComment: string | null;
  answers: Array<{
    criterionId: number;
    level: CriterionLevel;
    comment: string | null;
  }>;
}
