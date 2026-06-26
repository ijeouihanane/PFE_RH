import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ContractResponse, ContractCreateDto, ContractUpdateDto, ContractType, ContractStatus } from './contract.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ContractService {
  private readonly base = `${environment.apiUrl}/api/contracts`;

  constructor(private http: HttpClient) {}

  list(type?: ContractType, status?: ContractStatus, employeeId?: number): Observable<ContractResponse[]> {
    let params = new HttpParams();
    if (type)       params = params.set('type', type);
    if (status)     params = params.set('status', status);
    if (employeeId) params = params.set('employeeId', employeeId.toString());
    return this.http.get<ContractResponse[]>(this.base, { params });
  }

  getById(id: number): Observable<ContractResponse> {
    return this.http.get<ContractResponse>(`${this.base}/${id}`);
  }

  createDraft(dto: ContractCreateDto): Observable<ContractResponse> {
    return this.http.post<ContractResponse>(`${this.base}/drafts`, dto);
  }

  update(id: number, dto: ContractUpdateDto): Observable<ContractResponse> {
    return this.http.put<ContractResponse>(`${this.base}/${id}`, dto);
  }

  generate(id: number): Observable<ContractResponse> {
    return this.http.post<ContractResponse>(`${this.base}/${id}/generate`, {});
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  /**
   * Ouvre le PDF stocké directement dans un nouvel onglet via la gateway.
   * Même comportement que les bulletins de paie.
   * pdfUrl exemple : /uploads/contracts/12/4/contrat.pdf
   */
  openPdf(pdfUrl: string): void {
    window.open(`${environment.apiUrl}${pdfUrl}`, '_blank');
  }

  /** Fallback legacy — téléchargement via l'API si pdfUrl indisponible */
  downloadPdfById(id: number): void {
    window.open(`${this.base}/${id}/pdf`, '_blank');
  }

  getPayrollProfile(employeeId: number): Observable<{ baseSalary: number; fixedBonus: number }> {
    return this.http.get<{ baseSalary: number; fixedBonus: number }>(
      `${environment.apiUrl}/api/payroll/profiles/${employeeId}`
    );
  }
}
