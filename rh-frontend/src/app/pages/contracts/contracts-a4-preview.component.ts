import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Clause } from './contract.model';

@Component({
  standalone: true,
  selector: 'app-contracts-a4-preview',
  imports: [CommonModule],
  styles: [`
    :host { display: block; width: 100%; }

    /* ── Page A4 — même rendu que le PDF backend ── */
    .a4-page {
      background: white;
      width: 100%;
      max-width: 794px;
      min-height: 1123px;
      padding: 48pt 56pt;           /* identique au body padding du PDF */
      font-family: "Times New Roman", Times, serif;
      font-size: 12.5pt;
      line-height: 1.55;
      color: #111;
      box-sizing: border-box;
      margin: 0 auto 16px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.10);
      overflow-x: hidden;
    }

    /* ── Titre (identique au h1 PDF) ── */
    .contract-title {
      text-align: center;
      font-size: 14pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5pt;
      margin-bottom: 24pt;
    }

    /* ── Parties ── */
    .parties {
      margin-bottom: 18pt;
    }
    .parties p {
      margin-bottom: 9pt;
      text-align: justify;
    }

    /* ── Articles ── */
    .article {
      margin-bottom: 14pt;
      text-align: justify;
    }
    .art-title {
      font-weight: bold;
      margin-bottom: 6pt;
    }
    ::ng-deep .art-body { text-align: justify; }
    ::ng-deep .art-body p { margin: 0 0 5pt; }
    ::ng-deep .art-body ul,
    ::ng-deep .art-body ol { margin: 4pt 0 6pt 18pt; }
    ::ng-deep .art-body li { margin-bottom: 3pt; }
    ::ng-deep .art-body strong { font-weight: bold; }
    ::ng-deep .art-body em { font-style: italic; }

    /* ── Bloc signatures ── */
    .sigs {
      margin-top: 32pt;
    }
    .fait-a {
      margin-bottom: 4pt;
    }
    .sigs table {
      width: 100%;
      border-collapse: collapse;
      border: none;
    }
    .sigs td {
      width: 50%;
      vertical-align: top;
      padding: 0;
    }
    .sig-label {
      font-weight: bold;
      margin-bottom: 4pt;
    }
    .sig-info {
      font-size: 11.5pt;
      margin-bottom: 3pt;
    }
    /* Espace pour la signature physique */
    .sig-space {
      display: block;
      height: 48pt;
    }
  `],
  template: `
    <div class="a4-page">

      <div class="contract-title">
        CONTRAT DE TRAVAIL À DURÉE {{ data?.type === 'CDD' ? 'DÉTERMINÉE' : 'INDÉTERMINÉE' }}
      </div>

      <div class="parties">
        <p><strong>ENTRE LES SOUSSIGNÉS :</strong></p>
        <p>La Société <strong>TechCorp</strong>, dont le siège social est situé à Casablanca, représentée par M.
           <strong>Mohammad BAKKALI</strong>, en sa qualité d'Associé-gérant, ci-après désignée <em>« la Société »</em>,</p>
        <p>D'une part,</p>
        <p><strong>Et :</strong></p>
        <p>M. / Mme <strong>{{ data?.employeeFullName || '[nom du salarié]' }}</strong>,
           titulaire de la CIN n°&nbsp;{{ data?.employeeCin || '[CIN]' }},</p>
        <p>Ci-après dénommé(e) <em>« le (la) Salarié(e) »</em>,</p>
        <p>D'autre part,</p>
        <p><em>Il a été convenu ce qui suit :</em></p>
      </div>

      <!-- Articles dynamiques -->
      <div class="article" *ngFor="let cl of clauses">
        <div class="art-title">{{ cl.title }}</div>
        <div class="art-body" [innerHTML]="cl.html"></div>
      </div>

      <!-- Signatures -->
      <div class="sigs">
        <p class="fait-a">Fait à <span>{{ data?.signaturePlace || '[lieu de signature]' }}</span>,
          le <span>{{ data?.signatureDate || '[date de signature]' }}</span></p>
        <p *ngIf="data?.type === 'CDD'">En deux exemplaires originaux.</p>
        <br>
        <table>
          <tr>
            <td>
              <div class="sig-label">Pour la Société</div>
              <div class="sig-info">Nom : Mohammad BAKKALI</div>
              <div class="sig-info">Fonction : Associé-gérant</div>
              <div class="sig-info">Signature et cachet</div>
              <span class="sig-space"></span>
            </td>
            <td>
              <div class="sig-label">Le (la) Salarié(e)</div>
              <div class="sig-info">M. / Mme {{ data?.employeeFullName || '[Nom Prénom]' }}</div>
              <div class="sig-info">Signature précédée de la mention manuscrite « Lu et approuvé »</div>
              <span class="sig-space"></span>
            </td>
          </tr>
        </table>
      </div>

    </div>
  `
})
export class ContractsA4PreviewComponent {
  @Input() data: any    = {};
  @Input() clauses: Clause[] = [];
}
