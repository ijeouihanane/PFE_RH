import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { GridDetail, GridSummary, PublishGridPayload } from './appraisal-grid.model';

@Injectable({ providedIn: 'root' })
export class AppraisalGridService {
  private readonly baseUrl = `${environment.apiUrl}/api/appraisal-grids`;

  constructor(private readonly http: HttpClient) {}

  list(): Observable<GridSummary[]> {
    return this.http.get<GridSummary[]>(this.baseUrl);
  }

  detail(id: number): Observable<GridDetail> {
    return this.http.get<GridDetail>(`${this.baseUrl}/${id}`);
  }

  versions(id: number): Observable<GridSummary[]> {
    return this.http.get<GridSummary[]>(`${this.baseUrl}/${id}/versions`);
  }

  availableDepartments(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/available-departments`);
  }

  create(payload: PublishGridPayload): Observable<GridDetail> {
    return this.http.post<GridDetail>(this.baseUrl, payload);
  }

  publishVersion(id: number, payload: PublishGridPayload): Observable<GridDetail> {
    return this.http.post<GridDetail>(`${this.baseUrl}/${id}/versions`, payload);
  }
}
