import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ExpenseClaim, ExpenseClaimSummary, ReimbursementMode } from './expense-claims.model';

@Injectable({ providedIn: 'root' })
export class ExpenseClaimsService {
  private readonly baseUrl = `${environment.apiUrl}/api/expense-claims`;

  constructor(private readonly http: HttpClient) {}

  myClaims(): Observable<ExpenseClaim[]> {
    return this.http.get<ExpenseClaim[]>(`${this.baseUrl}/my`);
  }

  mySummary(): Observable<ExpenseClaimSummary> {
    return this.http.get<ExpenseClaimSummary>(`${this.baseUrl}/my/summary`);
  }

  rhClaims(): Observable<ExpenseClaim[]> {
    return this.http.get<ExpenseClaim[]>(`${this.baseUrl}/rh`);
  }

  rhSummary(): Observable<ExpenseClaimSummary> {
    return this.http.get<ExpenseClaimSummary>(`${this.baseUrl}/rh/summary`);
  }

  create(formData: FormData): Observable<ExpenseClaim> {
    return this.http.post<ExpenseClaim>(this.baseUrl, formData);
  }

  update(id: number, formData: FormData): Observable<ExpenseClaim> {
    return this.http.put<ExpenseClaim>(`${this.baseUrl}/${id}`, formData);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  approve(id: number): Observable<ExpenseClaim> {
    return this.http.post<ExpenseClaim>(`${this.baseUrl}/${id}/approve`, {});
  }

  reject(id: number, reason: string): Observable<ExpenseClaim> {
    return this.http.post<ExpenseClaim>(`${this.baseUrl}/${id}/reject`, { reason });
  }

  reimburse(id: number, payload: { mode: ReimbursementMode; date: string; note: string; proof: File | null }): Observable<ExpenseClaim> {
    const formData = new FormData();
    formData.append('reimbursementMode', payload.mode);
    formData.append('reimbursedAt', payload.date);
    formData.append('reimbursementNote', payload.note);
    if (payload.proof) {
      formData.append('proof', payload.proof);
    }
    return this.http.post<ExpenseClaim>(`${this.baseUrl}/${id}/reimburse`, formData);
  }
}
