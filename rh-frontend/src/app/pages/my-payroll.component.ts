import { Component } from '@angular/core';
import { NgFor, NgIf, DecimalPipe, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Component({
  standalone: true,
  selector: 'app-my-payroll',
  imports: [NgIf, NgFor, DecimalPipe, DatePipe],
  template: `
    <div class="page-wrap">
      <div class="page-header">
        <h2>Mes Bulletins de Paie</h2>
        <p class="muted">Retrouvez ici l'historique de vos bulletins de paie disponibles au téléchargement.</p>
      </div>

      <div class="card inner">
        <div *ngIf="loading" class="loading-state">
          <div class="spinner"></div>
          <span>Chargement en cours...</span>
        </div>

        <table *ngIf="!loading && slips.length > 0">
          <thead>
            <tr>
              <th>Période</th>
              <th class="col-net">Net à payer</th>
              <th class="col-date">Date réception</th>
              <th class="col-action-th">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of slips">
              <td>
                <strong>{{ p.mois | number:'2.0-0' }}/{{ p.annee }}</strong>
              </td>
              <td class="col-net">
                <span *ngIf="p.netPay" class="net-amount">{{ p.netPay | number:'1.2-2' }} DH</span>
                <span *ngIf="!p.netPay" class="muted">—</span>
              </td>
              <td class="col-date muted">
                {{ p.sentAt ? (p.sentAt | date:'dd/MM/yyyy') : (p.updatedAt | date:'dd/MM/yyyy') }}
              </td>
              <td class="col-action">
                <a [href]="resolveUrl(p)" target="_blank" rel="noreferrer" class="btn-dl"
                   [class.disabled]="!resolveUrl(p) || resolveUrl(p) === '#'">
                  Télécharger PDF
                </a>
              </td>
            </tr>
          </tbody>
        </table>

        <div *ngIf="!loading && slips.length === 0" class="empty-state">
          <p>Aucun bulletin de paie disponible pour le moment.</p>
          <p class="muted">Vos bulletins seront visibles ici une fois envoyés par l'équipe RH.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-wrap { max-width: 860px; margin: 0 auto; }
    .page-header { margin-bottom: 24px; }
    .page-header h2 { margin: 0 0 6px; font-size: 1.4em; color: #0f172a; font-weight: 700; }
    .muted { color: #64748b; font-size: 0.93em; margin: 0; }

    .inner {
      margin-top: 0;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 4px rgba(0,0,0,.05);
      border-radius: 10px;
      overflow: hidden;
      padding: 0;
    }

    .loading-state {
      display: flex; align-items: center; gap: 12px; padding: 40px 24px;
      color: #3b82f6; font-weight: 500;
    }
    .spinner {
      width: 20px; height: 20px; border: 3px solid #dbeafe;
      border-top-color: #3b82f6; border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 14px 20px; border-bottom: 1px solid #e2e8f0; }
    th {
      background: #f8fafc; font-weight: 600; color: #475569;
      text-align: left; font-size: 0.88em; text-transform: uppercase; letter-spacing: .04em;
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #f8fafc; }

    .col-net { text-align: center; }
    .col-date { text-align: center; }
    .net-amount { font-weight: 700; color: #0f172a; }

    .col-action { text-align: right; }
    .col-action-th { text-align: right; padding-right: 55px; }

    .btn-dl {
      display: inline-flex; align-items: center; gap: 6px;
      background: #2563eb; color: white;
      padding: 7px 16px; border-radius: 7px;
      font-size: 0.88em; font-weight: 600;
      text-decoration: none; transition: background 0.2s;
    }
    .btn-dl:hover { background: #1d4ed8; }
    .btn-dl.disabled { background: #94a3b8; cursor: not-allowed; pointer-events: none; }

    .empty-state {
      padding: 56px 24px; text-align: center; color: #64748b;
    }
    .empty-state p { margin: 6px 0; }
  `],
})
export class MyPayrollComponent {
  slips: any[] = [];
  loading = true;

  constructor(private readonly http: HttpClient) {
    this.http.get<any[]>(`${environment.apiUrl}/api/payroll/my-payslips`).subscribe({
      next: (p) => { this.slips = p; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  resolveUrl(p: any): string {
    const url = p.pdfUrl || p.fichierUrl;
    if (!url) return '#';
    if (url.startsWith('http')) return url;
    return `${environment.apiUrl}${url}`;
  }
}
