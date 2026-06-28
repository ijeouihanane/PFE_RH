import { Component } from '@angular/core';
import { NgFor, NgIf, DecimalPipe, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Component({
  standalone: true,
  selector: 'app-my-payroll',
  imports: [NgIf, NgFor, DecimalPipe, DatePipe],
  template: `
    <div class="mp-shell">

      <!-- Sticky topbar -->
      <header class="mp-topbar">
        <div>
          <h1 class="mp-topbar-title">Mes Bulletins de Paie</h1>
          <p class="mp-topbar-sub">Consultez et téléchargez vos fiches de paie</p>
        </div>
        <span class="mp-count-chip" *ngIf="!loading && slips.length > 0">
          {{ slips.length }} bulletin{{ slips.length > 1 ? 's' : '' }}
        </span>
      </header>

      <!-- Scrollable body -->
      <div class="mp-body">

        <!-- KPI row -->
        <div class="mp-kpi-row" *ngIf="!loading && slips.length > 0">
          <div class="mp-kpi">
            <div class="mp-kpi-icon blue">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div class="mp-kpi-text">
              <span class="mp-kpi-label">Dernier bulletin</span>
              <span class="mp-kpi-val">{{ slips[0].mois | number:'2.0-0' }}/{{ slips[0].annee }}</span>
            </div>
          </div>
          <div class="mp-kpi">
            <div class="mp-kpi-icon green">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                <path d="M8 12l3 3 5-5"/>
              </svg>
            </div>
            <div class="mp-kpi-text">
              <span class="mp-kpi-label">Net à payer (dernier)</span>
              <span class="mp-kpi-val green">{{ slips[0].netPay | number:'1.2-2' }} <small>DH</small></span>
            </div>
          </div>
          <div class="mp-kpi">
            <div class="mp-kpi-icon purple">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <div class="mp-kpi-text">
              <span class="mp-kpi-label">Total reçus</span>
              <span class="mp-kpi-val">{{ slips.length }}</span>
            </div>
          </div>
        </div>

        <!-- Loading -->
        <div *ngIf="loading" class="mp-loading">
          <div class="mp-spin"></div>
          <span>Chargement de vos bulletins...</span>
        </div>

        <!-- Table card -->
        <div class="mp-card" *ngIf="!loading && slips.length > 0">
          <div class="mp-card-header">
            <svg width="15" height="15" fill="none" stroke="#64748b" stroke-width="2" viewBox="0 0 24 24">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
            <span>Historique</span>
          </div>
          <div class="mp-table-wrap">
            <table class="mp-table">
              <thead>
                <tr>
                  <th class="th-center">Période</th>
                  <th class="th-center">Net à payer</th>
                  <th class="th-center">Date de réception</th>
                  <th class="th-center">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let p of slips">
                  <td class="td-center">
                    <span class="period-val">{{ p.mois | number:'2.0-0' }}/{{ p.annee }}</span>
                  </td>
                  <td class="td-center">
                    <span class="net-pill" *ngIf="p.netPay">{{ p.netPay | number:'1.2-2' }} DH</span>
                    <span class="td-empty" *ngIf="!p.netPay">—</span>
                  </td>
                  <td class="td-center date-cell">
                    {{ p.sentAt ? (p.sentAt | date:'dd/MM/yyyy') : (p.updatedAt | date:'dd/MM/yyyy') }}
                  </td>
                  <td class="td-center">
                    <a [href]="resolveUrl(p)" target="_blank" rel="noreferrer"
                       class="dl-btn" title="Télécharger le bulletin"
                       [class.dl-off]="!resolveUrl(p) || resolveUrl(p) === '#'">
                      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Empty -->
        <div class="mp-empty" *ngIf="!loading && slips.length === 0">
          <div class="mp-empty-ico">
            <svg width="36" height="36" fill="none" stroke="#94a3b8" stroke-width="1.3" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/>
            </svg>
          </div>
          <p class="mp-empty-title">Aucun bulletin disponible</p>
          <p class="mp-empty-sub">Vos bulletins de paie apparaîtront ici une fois transmis par l'équipe RH.</p>
        </div>

      </div>
    </div>
  `,
  styles: [`
    /* ── Reset content padding for this page ── */
    ::ng-deep .content:has(.mp-shell) { padding: 0 !important; }

    .mp-shell {
      display: flex; flex-direction: column; height: 100%;
      font-family: 'Inter', -apple-system, sans-serif;
    }

    /* ── Sticky topbar ── */
    .mp-topbar {
      position: sticky; top: 0; z-index: 10;
      background: #fff; border-bottom: 1px solid #dbe3ee;
      min-height: 78px; padding: 16px 28px;
      display: flex; align-items: center; justify-content: space-between; gap: 18px;
      flex-shrink: 0;
    }
    .mp-topbar-title { 
      margin: 0; 
      font-size: 18px; 
      line-height: 1.2; 
      font-weight: 600; 
      color: #0f172a; 
      letter-spacing: 0;
    }
    .mp-topbar-sub { 
      margin: 4px 0 0; 
      color: #475569; 
      font-size: 13px; 
    }
    .mp-count-chip {
      background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe;
      border-radius: 6px; padding: 6px 14px; font-size: 14px; font-weight: 500;
    }

    /* ── Body (scrolls) ── */
    .mp-body { flex: 1; overflow-y: auto; padding: 28px; }

    /* ── KPIs ── */
    .mp-kpi-row { display: flex; gap: 14px; margin-bottom: 24px; flex-wrap: wrap; }
    .mp-kpi {
      flex: 1; min-width: 160px;
      background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
      padding: 16px 18px; display: flex; align-items: center; gap: 14px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .mp-kpi-icon {
      width: 38px; height: 38px; border-radius: 10px;
      display: grid; place-items: center; flex-shrink: 0;
    }
    .mp-kpi-icon.blue  { background: #eff6ff; color: #2563eb; }
    .mp-kpi-icon.green { background: #f0fdf4; color: #16a34a; }
    .mp-kpi-icon.purple{ background: #faf5ff; color: #7c3aed; }
    .mp-kpi-label { display: block; font-size: 0.72em; color: #64748b; font-weight: 500; margin-bottom: 2px; }
    .mp-kpi-val { font-size: 1em; font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; }
    .mp-kpi-val.green { color: #15803d; }
    .mp-kpi-val small { font-size: 0.65em; font-weight: 500; color: #64748b; }

    /* ── Loading ── */
    .mp-loading {
      display: flex; align-items: center; gap: 12px; justify-content: center;
      padding: 60px; color: #3b82f6; font-size: 0.9em; font-weight: 500;
    }
    .mp-spin {
      width: 20px; height: 20px; border: 2.5px solid #dbeafe;
      border-top-color: #3b82f6; border-radius: 50%;
      animation: mp-rotate 0.7s linear infinite;
    }
    @keyframes mp-rotate { to { transform: rotate(360deg); } }

    /* ── Table card ── */
    .mp-card {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
      overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.04);
    }
    .mp-card-header {
      display: flex; align-items: center; gap: 8px;
      padding: 14px 20px; border-bottom: 1px solid #f1f5f9;
      font-size: 0.83em; font-weight: 600; color: #475569;
    }
    .mp-table-wrap { overflow-x: auto; }
    .mp-table { width: 100%; border-collapse: collapse; }
    .mp-table th {
      padding: 11px 20px; background: #f8fafc;
      font-size: 0.75em; font-weight: 700; color: #64748b;
      text-transform: uppercase; letter-spacing: 0.06em;
      border-bottom: 1px solid #e2e8f0; white-space: nowrap;
    }
    .mp-table td {
      padding: 13px 20px; border-bottom: 1px solid #f1f5f9;
      font-size: 0.9em; color: #334155; vertical-align: middle;
    }
    .mp-table tbody tr:last-child td { border-bottom: none; }
    .mp-table tbody tr:hover td { background: #fafbfd; }

    .th-center { text-align: center; }
    .td-center { text-align: center; }

    .period-val { font-weight: 600; color: #1e293b; font-variant-numeric: tabular-nums; }
    .net-pill {
      display: inline-block;
      background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0;
      border-radius: 6px; padding: 3px 10px; font-weight: 700; font-size: 0.9em;
      font-variant-numeric: tabular-nums;
    }
    .td-empty { color: #cbd5e1; }
    .date-cell { color: #64748b; font-size: 0.88em; }

    .dl-btn {
      display: inline-flex; align-items: center; justify-content: center;
      background: #2563eb; color: #fff;
      width: 32px; height: 32px; border-radius: 8px;
      text-decoration: none; transition: all 0.2s;
    }
    .dl-btn:hover { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 4px 10px rgba(37,99,235,0.2); }
    .dl-btn.dl-off { background: #e2e8f0; color: #94a3b8; pointer-events: none; box-shadow: none; }

    /* ── Empty ── */
    .mp-empty {
      padding: 64px 24px; text-align: center;
      background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
    }
    .mp-empty-ico {
      width: 72px; height: 72px; border-radius: 18px;
      background: #f8fafc; border: 1px solid #e2e8f0;
      display: grid; place-items: center; margin: 0 auto 18px;
    }
    .mp-empty-title { margin: 0 0 6px; font-size: 1em; font-weight: 700; color: #1e293b; }
    .mp-empty-sub { color: #94a3b8; font-size: 0.87em; max-width: 320px; margin: 0 auto; line-height: 1.6; }
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
