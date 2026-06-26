import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Appraisal, AppraisalContext, DraftPayload } from './appraisal.model';

@Injectable({ providedIn: 'root' })
export class AppraisalService {
  private readonly baseUrl = `${environment.apiUrl}/api/appraisals`;

  constructor(private readonly http: HttpClient) {}

  context(employeeId: number): Observable<AppraisalContext> {
    return this.http.get<AppraisalContext>(`${this.baseUrl}/context/${employeeId}`);
  }

  draftContext(appraisalId: number): Observable<AppraisalContext> {
    return this.http.get<AppraisalContext>(`${this.baseUrl}/draft/${appraisalId}/context`);
  }

  createDraft(payload: DraftPayload): Observable<Appraisal> {
    return this.http.post<Appraisal>(`${this.baseUrl}/draft`, payload);
  }

  updateDraft(id: number, payload: DraftPayload): Observable<Appraisal> {
    return this.http.patch<Appraisal>(`${this.baseUrl}/${id}/draft`, payload);
  }

  submit(id: number): Observable<Appraisal> {
    return this.http.post<Appraisal>(`${this.baseUrl}/${id}/submit`, {});
  }

  managerList(): Observable<Appraisal[]> {
    return this.http.get<Appraisal[]>(`${this.baseUrl}/my-team`);
  }

  employeeList(): Observable<Appraisal[]> {
    return this.http.get<Appraisal[]>(`${this.baseUrl}/me`);
  }

  rhList(): Observable<Appraisal[]> {
    return this.http.get<Appraisal[]>(this.baseUrl);
  }

  acknowledge(id: number, employeeComment: string): Observable<Appraisal> {
    return this.http.post<Appraisal>(`${this.baseUrl}/${id}/acknowledge`, { employeeComment });
  }

  validateRh(id: number): Observable<Appraisal> {
    return this.http.post<Appraisal>(`${this.baseUrl}/${id}/rh-validate`, {});
  }
}
