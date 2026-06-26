export enum ContractType {
  CDI = 'CDI',
  CDD = 'CDD'
}

export enum ContractStatus {
  BROUILLON = 'BROUILLON',
  GENERE = 'GENERE'
}

export interface Clause {
  id: string;
  title: string;
  html: string;
}

export interface ContractResponse {
  id: number;
  employeeId: number;
  employeeFullName: string;
  employeeMatricule: string;
  employeeCin: string;
  employeePoste: string;
  employeeDepartement: string;
  employeeEmail: string;
  employeeHireDate: string;
  type: ContractType;
  status: ContractStatus;
  startDate: string;
  endDate?: string;
  workplace: string;
  signaturePlace: string;
  signatureDate: string;
  trialPeriod: string;
  noticePeriod: string;
  baseSalary: number;
  fixedBonus: number;
  formDataJson: string;
  clausesJson: string;
  renderedHtml?: string;
  pdfUrl?: string;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  generatedAt?: string;
}

export interface ContractCreateDto {
  type: ContractType;
  employeeId: number;
  employeeFullName?: string;
  employeeMatricule?: string;
  employeeCin?: string;
  employeePoste?: string;
  employeeDepartement?: string;
  employeeEmail?: string;
  employeeHireDate?: string;
  startDate: string;
  endDate?: string;
  workplace?: string;
  signaturePlace?: string;
  signatureDate?: string;
  trialPeriod?: string;
  noticePeriod?: string;
  baseSalary?: number;
  fixedBonus?: number;
  formDataJson?: string;
  clausesJson?: string;
}

export type ContractUpdateDto = Partial<ContractCreateDto>;
