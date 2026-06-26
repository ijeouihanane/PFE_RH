export interface GridCriterion {
  id?: number;
  label: string;
  description: string;
  displayOrder: number;
}

export interface GridSummary {
  id: number;
  code: string;
  label: string;
  department?: string | null;
  version: number;
  criterionCount: number;
  active: boolean;
  generic: boolean;
  publishedAt: string;
  updatedAt: string;
}

export interface GridDetail extends Omit<GridSummary, 'criterionCount'> {
  criteria: GridCriterion[];
}

export interface PublishGridPayload {
  department: string;
  label: string;
  expectedVersion: number | null;
  criteria: Array<{ label: string; description: string }>;
}
