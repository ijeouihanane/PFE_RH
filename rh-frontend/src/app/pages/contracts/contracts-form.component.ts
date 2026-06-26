import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ContractService } from './contract.service';
import { Clause, ContractCreateDto } from './contract.model';
import { ContractsA4PreviewComponent } from './contracts-a4-preview.component';
import { ContractsClauseModalComponent } from './contracts-clause-modal.component';
import { environment } from '../../../environments/environment';

// ─────────────────────────────────────────────────────────────────────────────
// Placeholders lisibles si valeur manquante
// ─────────────────────────────────────────────────────────────────────────────
const PH: Record<string, string> = {
  employeeFullName: '[nom du salarié]',
  poste: '[poste]',
  cin: '[CIN]',
  startDate: '[date de début à préciser]',
  endDate: '[date de fin à préciser]',
  workplace: '[lieu de travail à préciser]',
  trialPeriod: '[période d\'essai à préciser]',
  noticePeriod: '[préavis à préciser]',
  baseSalary: '[salaire à préciser]',
  fixedBonus: '[prime fixe à préciser]',
};

function interp(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? PH[k] ?? `[${k}]`);
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function fmtNum(v: number | null | undefined): string {
  if (v == null || v === 0) return '';
  return new Intl.NumberFormat('fr-FR').format(v);
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT CLAUSES — CDI (full content, no summarisation)
// ─────────────────────────────────────────────────────────────────────────────
const CDI_DEFAULTS: Clause[] = [
  {
    id: '1', title: 'Article 1 : Engagement',
    html: `<p>La Société engage M. / Mme <strong>{{employeeFullName}}</strong> pour exercer la fonction de <strong>{{poste}}</strong> à compter du <strong>{{startDate}}</strong> sous réserve des résultats de la visite médicale d'embauche.</p>
<p>Le présent contrat de travail est conclu pour une durée indéterminée à compter de sa signature par les deux parties.</p>
<p>M. / Mme <strong>{{employeeFullName}}</strong> déclare qu'il (elle) est libre de tout engagement envers ses précédents employeurs, comme il (elle) est libre de toutes obligations ou contraintes.</p>`
  },
  {
    id: '2', title: 'Article 2 : Fonction',
    html: `<p>Le/la Salarié(e) est engagé(e) pour la fonction de <strong>{{poste}}</strong>. Toutefois, en fonction des circonstances et de l'évolution des structures, le/la Salarié(e) peut être amené(e) à exercer toutes autres fonctions compatibles avec sa qualification.</p>`
  },
  {
    id: '3', title: 'Article 3 : Période d\'essai et confirmation',
    html: `<p>M. / Mme <strong>{{employeeFullName}}</strong> est soumis(e) à une période d'essai de <strong>{{trialPeriod}}</strong> au cours de laquelle chacune des deux parties pourra mettre fin à son engagement sans indemnité, à charge pour celle qui décide de s'en départir de prévenir l'autre partie par un simple préavis de <strong>{{noticePeriod}}</strong>.</p>
<p>À l'issue de cette période, et selon l'appréciation des responsables, M. / Mme <strong>{{employeeFullName}}</strong> sera soit :</p>
<ul>
  <li>Confirmé(e) dans son poste ;</li>
  <li>Soumis(e) par écrit à une nouvelle période d'essai pour la même durée.</li>
</ul>
<p>Le silence de la Société passé le délai de <strong>{{trialPeriod}}</strong> vaudra confirmation de M. / Mme <strong>{{employeeFullName}}</strong> dans son poste.</p>`
  },
  {
    id: '4', title: 'Article 4 : Rémunération et avantages',
    html: `<p>M. / Mme <strong>{{employeeFullName}}</strong> percevra une rémunération mensuelle de base de <strong>{{baseSalary}} MAD</strong> qui sera soumise aux prélèvements et cotisations de toutes sortes auxquels les salaires sont soumis.</p>
<p>Cette rémunération sera servie pendant 13 mois, ce dernier étant payable en deux fois (50 % à la fin du mois de Juin et 50 % à la fin du mois de Décembre).</p>
<p>Il (elle) percevra aussi une prime fixe mensuelle de <strong>{{fixedBonus}} MAD</strong>, ainsi qu'une prime annuelle équivalente à [pourcentage à préciser] % de son salaire de base brut annuel, attribuée selon sa performance et son rendement si les objectifs du poste sont pleinement réalisés et atteints.</p>
<p>M. / Mme <strong>{{employeeFullName}}</strong> sera affilié(e) aux régimes de retraite de la CIMR et à l'Assurance de Groupe. Les taux de la cotisation salariale sont de « 6 % pour la CIMR » et de « 2,65 % pour l'assurance maladie ».</p>`
  },
  {
    id: '5', title: 'Article 5 : Lieu de travail et mobilité',
    html: `<p>Le lieu de travail est fixé à <strong>{{workplace}}</strong>.</p>
<p>En cas de changement éventuel de celui-ci pour quelque raison que ce soit ou en cas de réorganisation de la Société, cela ne constituera pas une modification du contrat de travail.</p>
<p>En cas de transfert ou de cession, l'Employé(e) s'engage à ne pas s'y opposer, ni prétendre à aucune rémunération supplémentaire ou des privilèges de quelque nature que ce soit.</p>`
  },
  {
    id: '6', title: 'Article 6 : Frais de déplacements',
    html: `<p>Dans le cadre de ses déplacements, une voiture de fonction sera mise à la disposition de l'Employé(e), avec un forfait mensuel de [montant à préciser] MAD pour les frais d'entretien, ainsi qu'une carte de carburant plafonnée à [montant à préciser] MAD par mois.</p>
<p>Une indemnité mensuelle nette de transport d'un montant de [montant à préciser] MAD payable sur 12 mois.</p>`
  },
  {
    id: '7', title: 'Article 7 : Congés payés',
    html: `<p>L'Employé(e) a droit à un congé annuel de 21 jours (vingt et un jours) pour douze mois de service effectif.</p>
<p>La date de départ en congé est fixée d'un commun accord entre la Société et l'Employé(e) compte tenu des besoins du service et selon le planning établi à cet effet.</p>
<p>La demande prévisionnelle du congé doit être déposée à la fin du mois de Mars.</p>`
  },
  {
    id: '8', title: 'Article 8 : Jours de fête et jours fériés',
    html: `<p>L'Employé(e) bénéficiera des congés prévus par le Code du travail pour les fêtes nationales, les fêtes religieuses ainsi que les congés spéciaux pour évènements tels que mariage, décès et congés de maternité.</p>`
  },
  {
    id: '9', title: 'Article 9 : Congé maladie',
    html: `<p>Dans le cas où l'Employé(e) ne peut pas se rendre à son travail pour cause de maladie ou d'accident, il (elle) devra en aviser sans délai la Société et produire un certificat médical dans les quarante-huit (48) heures.</p>
<p>La Société se réserve le droit de pratiquer un contrôle médical par un médecin de son choix au dernier domicile de l'Employé(e) déclaré par ce dernier.</p>`
  },
  {
    id: '10', title: 'Article 10 : Obligations professionnelles',
    html: `<p><strong>10.1. Code de conduite et Règlement interne</strong></p>
<p>L'Employé(e) s'engage à se conformer aux règles régissant le fonctionnement interne de la Société, notamment celles contenues dans le règlement intérieur ainsi qu'aux codes de conduites de la société, documents qui lui sont remis, ce qu'il (elle) reconnaît expressément et dont il (elle) déclare y adhérer sans réserve.</p>
<p><strong>10.2. Confidentialité</strong></p>
<p>L'Employé(e) est tenu(e) d'observer une discrétion absolue à l'intérieur comme à l'extérieur de la Société en ce qui concerne les méthodes, moyens et matériels utilisés par la Société dont il (elle) aura eu connaissance directement ou indirectement dans l'exercice de ses fonctions.</p>
<p>En outre, l'Employé(e) s'engage à ne faire aucune déclaration publique portant sur la Société ou sur toute autre Société du Groupe, sans en référer au préalable à sa hiérarchie directe.</p>
<p>L'obligation de discrétion à laquelle l'Employé(e) est tenu(e) telle que définie ci-dessus, demeurera en vigueur après la cessation de ses fonctions au sein de la Société et sans limitation de durée.</p>
<p>Tous les documents, lettres, notes de service et instructions qui lui seront remis ou dont il (elle) pourrait avoir connaissance ou avoir créé dans l'exercice de ses fonctions restent la propriété exclusive de la Société et ils devront lui être restitués sur simple demande.</p>
<p><strong>10.3. Exclusivité</strong></p>
<p>L'Employé(e) s'engage à réserver son activité au service exclusif de la Société et ne pourra pendant toute la durée du présent contrat, exercer une autre activité professionnelle de quelque nature que ce soit, rémunérée ou non, pour son propre compte ou pour celui d'un tiers ou par personne interposée.</p>
<p>L'Employé(e) s'interdit pendant l'exécution du présent contrat de s'intéresser, directement ou indirectement, de quelque manière que ce soit et à quelque titre que ce soit, à toute activité créée, en voie de création ou à créer, personnelle ou non, susceptible de faire concurrence, directement ou indirectement à la Société.</p>
<p>Cette violation entraînera ipso facto la dénonciation du contrat de collaboration sans préavis ni indemnités dans les formes prévues par la loi.</p>
<p><strong>10.4. Informations et diplômes</strong></p>
<p>L'Employé(e) s'engage à remettre à la Société au plus tard dans les trois mois de la signature du présent contrat tous les diplômes et attestations justifiant son embauche par la Société.</p>
<p>Il (elle) s'engage également à informer la Société par écrit de toute modification intervenant dans lesdites informations.</p>
<p>Il (elle) atteste expressément de l'exactitude de toutes les données et documents qu'il (elle) a communiqués.</p>
<p><strong>10.5. Préservation des biens de la Société</strong></p>
<p>L'Employé(e) s'engage à préserver et entretenir tous les moyens de travail mis à sa disposition par la Société et à ne pas les utiliser pour ses propres besoins.</p>`
  },
  {
    id: '11', title: 'Article 11 : Modalités de rupture du Contrat',
    html: `<p><strong>11.1.</strong> Le présent contrat pourra prendre fin soit par consentement mutuel soit à l'initiative de l'une des parties dans les conditions prévues par le Code du Travail.</p>
<p>Le préavis à respecter de part et d'autre est de <strong>{{noticePeriod}}</strong>.</p>
<p><strong>11.2.</strong> Il pourra être résilié de plein droit par la Société sans préavis ni indemnité pour l'un des motifs énumérés ci-après :</p>
<p><strong>a)</strong> La faute grave de l'Employé(e), l'indiscipline caractérisée, le refus d'obéir aux ordres donnés ou d'accomplir le travail pour lequel il (elle) a été engagé(e).</p>
<p>Sont considérées comme fautes graves sans que cette liste soit limitative :</p>
<ul>
  <li>Le fait de s'adonner à d'autres occupations pendant le temps normalement consacré à son travail ou d'avoir une activité parallèle ;</li>
  <li>Le fait de ne pas se conformer aux directives de la hiérarchie ;</li>
  <li>Le fait d'avoir une présentation ou un comportement personnel incompatible avec ses fonctions et les relations qu'il (elle) sera chargé(e) d'entretenir avec ses supérieurs, ses collègues et les clients ou fournisseurs de la Société ;</li>
  <li>Les insultes, rixes, injures envers eux ;</li>
  <li>Le fait de commettre des infractions au règlement intérieur.</li>
</ul>
<p><strong>b)</strong> La Non Performance : la Société pourra, si l'Employé(e) ne réalise pas les objectifs qui lui ont été fixés pendant deux années consécutives et même après un Plan d'Amélioration de la Performance, mettre fin à ses services sans indemnité.</p>
<p><strong>c)</strong> L'impossibilité d'exécuter le présent contrat résultant d'un cas fortuit ou d'une force majeure ;</p>
<p><strong>d)</strong> Les cas prévus par le Code du travail.</p>
<p><strong>e)</strong> L'inobservation des dispositions du contrat d'embauche.</p>
<p>Dans toutes ces hypothèses, la Société se réserve le droit de réclamer des dommages et intérêts éventuels pour tout préjudice qu'elle pourra subir de ce fait.</p>`
  },
  {
    id: '12', title: 'Article 12 : Élection de domicile',
    html: `<p>Les parties élisent domicile en leurs adresses respectives. En cas de changement d'adresse, l'Employé(e) doit en informer la Société dans l'immédiat.</p>`
  },
  {
    id: '13', title: 'Article 13 : Compétence de juridiction',
    html: `<p>Tous les litiges qui pourront naître au sujet de l'exécution du présent contrat seront soumis à la compétence exclusive des tribunaux de Casablanca.</p>`
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT CLAUSES — CDD (full content, no summarisation)
// ─────────────────────────────────────────────────────────────────────────────
const CDD_DEFAULTS: Clause[] = [
  {
    id: '1', title: 'Article 1 : Motif',
    html: `<p>Le présent contrat est conclu pour l'un des motifs suivants (à préciser) :</p>
<ol>
  <li>Accroissement temporaire d'activité résultant de [description à préciser] ;</li>
  <li>Remplacement temporaire d'un salarié absent pour cause de [description à préciser] ;</li>
  <li>Activité saisonnière liée à [description à préciser] ;</li>
  <li>Ouverture récente de l'entreprise, lancement d'un nouveau chantier ou d'un nouveau produit : [description à préciser] ;</li>
  <li>Caractère temporaire par nature de l'emploi de [description à préciser] dans le secteur de [description à préciser].</li>
</ol>`
  },
  {
    id: '2', title: 'Article 2 : Engagement – Durée – Période d\'essai',
    html: `<p>La Société engage M. / Mme <strong>{{employeeFullName}}</strong> en qualité de <strong>{{poste}}</strong> à compter du <strong>{{startDate}}</strong>.</p>
<p>Le présent contrat est conclu pour une durée déterminée allant du <strong>{{startDate}}</strong> au <strong>{{endDate}}</strong>.</p>
<p>Il est conclu sous réserve d'une période d'essai de <strong>{{trialPeriod}}</strong> de travail effectif pour le poste concerné, au cours de laquelle chacune des parties pourra mettre fin au contrat sans indemnité, sous réserve d'en informer l'autre partie par écrit et de respecter un préavis de <strong>{{noticePeriod}}</strong>.</p>`
  },
  {
    id: '3', title: 'Article 3 : Fonctions',
    html: `<p>M. / Mme <strong>{{employeeFullName}}</strong> exercera les fonctions de <strong>{{poste}}</strong> avec la qualification de [qualification à préciser].</p>
<p>À ce titre, il/elle sera notamment chargé(e) de :</p>
<ul>
  <li>[mission à préciser] ;</li>
  <li>[mission à préciser] ;</li>
  <li>[mission à préciser].</li>
</ul>`
  },
  {
    id: '4', title: 'Article 4 : Rémunération',
    html: `<p>En contrepartie de son activité, M. / Mme <strong>{{employeeFullName}}</strong> percevra un salaire fixe mensuel de base de <strong>{{baseSalary}} MAD</strong> correspondant à la durée légale ou conventionnelle du travail en vigueur au sein de l'entreprise.</p>
<p>Pour information, en application des dispositions conventionnelles et/ou des politiques internes actuellement en vigueur au sein de l'entreprise, le salarié bénéficiera, le cas échéant, des indemnités et primes suivantes :</p>
<ul>
  <li>Prime fixe mensuelle : <strong>{{fixedBonus}} MAD</strong> ;</li>
  <li>[autres avantages à préciser].</li>
</ul>
<p>Toute modification des retenues sociales ou fiscales prévue par la législation en vigueur sera appliquée conformément aux textes légaux applicables.</p>`
  },
  {
    id: '5', title: 'Article 5 : Lieu de travail',
    html: `<p>Le lieu de travail de M. / Mme <strong>{{employeeFullName}}</strong> est fixé à <strong>{{workplace}}</strong>.</p>
<p>Tout changement du lieu de travail rendu nécessaire par les besoins de l'entreprise ne constituera pas une modification du présent contrat dès lors qu'il intervient dans les limites prévues par la réglementation applicable et les nécessités du service.</p>`
  },
  {
    id: '6', title: 'Article 6 : Fin du contrat',
    html: `<p>Le présent contrat prendra fin automatiquement à son terme, sauf renouvellement dans les conditions prévues par la réglementation applicable.</p>
<p>Il pourra également prendre fin avant son terme dans les cas prévus par la législation en vigueur, notamment en cas de faute grave ou de force majeure.</p>`
  },
  {
    id: '7', title: 'Article 7 : Remboursement des frais',
    html: `<p>Les frais engagés dans l'exercice des fonctions du salarié sont, sur présentation des justificatifs requis, pris en charge ou remboursés selon les modalités en vigueur au sein de la Société.</p>`
  },
  {
    id: '8', title: 'Article 8 : Congés payés',
    html: `<p>Le salarié bénéficie des congés payés conformément aux dispositions légales et réglementaires en vigueur.</p>
<p>Les dates de congé sont fixées d'un commun accord entre les parties, compte tenu des nécessités du service.</p>`
  },
  {
    id: '9', title: 'Article 9 : Protection sociale',
    html: `<p>Le salarié est affilié aux organismes de protection sociale et aux régimes de prévoyance applicables au sein de la Société, conformément à la réglementation en vigueur.</p>`
  },
  {
    id: '10', title: 'Article 10 : Règlement intérieur et charte informatique',
    html: `<p>Les parties s'engagent à respecter les dispositions légales, réglementaires et conventionnelles en vigueur au sein de l'entreprise.</p>
<p>Le salarié reconnaît avoir pris connaissance du règlement intérieur ainsi que, le cas échéant, de la charte informatique applicable au sein de la Société et s'engage à les respecter.</p>`
  },
  {
    id: '11', title: 'Article 11 : Confidentialité',
    html: `<p>Le salarié s'engage à observer la plus stricte confidentialité concernant toutes les informations, données, méthodes, procédés, études, projets, créations, devis et savoir-faire dont il (elle) pourrait avoir connaissance dans le cadre de ses fonctions.</p>
<p>Cette obligation de confidentialité demeure applicable même après la cessation du présent contrat.</p>`
  },
  {
    id: '12', title: 'Article 12 : Obligation de loyauté',
    html: `<p>Pendant toute la durée du contrat, le salarié s'engage à ne participer, directement ou indirectement, à aucune activité susceptible de concurrencer les activités de la Société ou de porter atteinte à ses intérêts légitimes.</p>`
  },
  {
    id: '13', title: 'Article 13 : Résiliation anticipée',
    html: `<p>En dehors des cas prévus par la loi, toute résiliation anticipée du présent contrat devra respecter les dispositions légales applicables.</p>`
  },
  {
    id: '14', title: 'Article 14 : Modification des informations personnelles',
    html: `<p>Le salarié s'engage à informer la Société dans les meilleurs délais de toute modification relative à sa situation personnelle, notamment son adresse ou toute information utile à la gestion de son dossier administratif.</p>
<p>Le salarié déclare être libre de tout engagement incompatible avec l'exécution du présent contrat et s'engage à consacrer son activité professionnelle au service de la Société pendant la durée du contrat.</p>`
  }
];

// ─────────────────────────────────────────────────────────────────────────────
@Component({
  standalone: true,
  selector: 'app-contracts-form',
  imports: [CommonModule, ReactiveFormsModule, ContractsA4PreviewComponent, ContractsClauseModalComponent],
  styles: [`
    /*
     * ── HOST : se positionne en fixed sur la zone contenu (hors sidebar 260px)
     * Cela évite que le shell global (min-height:100vh + padding) crée un scroll navigateur.
     * On ne touche pas au shell, on isole ce composant.
     */
    :host {
      display: flex;
      flex-direction: column;
      position: fixed;
      top: 0;
      left: 260px;          /* largeur de la sidebar */
      right: 0;
      bottom: 0;
      overflow: hidden;
      background: #f8f9fb;
      z-index: 1;           /* sous les modales (z-index 1100+) */
    }

    /* ── Scrollbars : invisibles au repos, grises au survol — scoped uniquement ── */
    /* Firefox */
    .left        { scrollbar-width: thin; scrollbar-color: transparent transparent; }
    .right       { scrollbar-width: thin; scrollbar-color: transparent transparent; }
    .prev-body   { scrollbar-width: thin; scrollbar-color: transparent transparent; }
    .left:hover        { scrollbar-color: #b0bec5 transparent; }
    .right:hover       { scrollbar-color: #b0bec5 transparent; }
    .prev-body:hover   { scrollbar-color: #b0bec5 transparent; }

    /* WebKit — 10px avec border trick pour un thumb fin avec espace */
    .left::-webkit-scrollbar,
    .right::-webkit-scrollbar,
    .prev-body::-webkit-scrollbar { width: 10px; background: transparent; }
    .left::-webkit-scrollbar-track,
    .right::-webkit-scrollbar-track,
    .prev-body::-webkit-scrollbar-track { background: transparent; }
    .left::-webkit-scrollbar-thumb,
    .right::-webkit-scrollbar-thumb,
    .prev-body::-webkit-scrollbar-thumb {
      background-color: transparent;
      background-clip: padding-box;
      border: 3px solid transparent;
      border-radius: 9999px;
      transition: background-color .25s ease;
    }
    .left:hover::-webkit-scrollbar-thumb,
    .right:hover::-webkit-scrollbar-thumb,
    .prev-body:hover::-webkit-scrollbar-thumb {
      background-color: #b0bec5;
    }
    .left::-webkit-scrollbar-thumb:hover,
    .right::-webkit-scrollbar-thumb:hover,
    .prev-body::-webkit-scrollbar-thumb:hover {
      background-color: #90a4ae;
    }

    /* ── Top bar ── */
    .topbar {
      flex: 0 0 56px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      background: white;
      border-bottom: 1px solid #e5e7eb;
      gap: 12px;
      z-index: 10;
    }
    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }
    .bc-link { color: #6b7280; cursor: pointer; background: none; border: none; font-size: 14px; padding: 0; }
    .bc-link:hover { color: #111827; }
    .bc-sep  { color: #d1d5db; }
    .bc-curr { font-weight: 700; color: #111827; }
    .badge-draft {
      display: inline-block;
      padding: 2px 10px;
      background: #fef3c7;
      color: #92400e;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 600;
    }
    .topbar-actions { display: flex; gap: 8px; flex-shrink: 0; }
    .btn-prev {
      background: white; border: 1px solid #e5e7eb; border-radius: 8px;
      padding: 8px 16px; font-size: 14px; font-weight: 500; cursor: pointer;
      color: #374151; white-space: nowrap;
    }
    .btn-prev:hover { background: #f9fafb; }
    .btn-save {
      background: white; border: 1px solid #374151; border-radius: 8px;
      padding: 8px 16px; font-size: 14px; font-weight: 500; cursor: pointer;
      color: #374151; white-space: nowrap;
    }
    .btn-save:hover { background: #f9fafb; }
    .btn-save:disabled, .btn-gen:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-gen {
      background: #2563eb; color: white; border: none; border-radius: 8px;
      padding: 8px 20px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap;
    }
    .btn-gen:hover:not(:disabled) { background: #1d4ed8; }

    /* ── Split body en grid 40 / 60 ── */
    .body {
      display: grid;
      grid-template-columns: minmax(320px, 40%) minmax(0, 1fr);
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    /* ── Left panel (formulaire) ── */
    .left {
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      border-right: 1px solid #e5e7eb;
      background: white;
    }
    .left-inner { padding: 20px 22px 40px; }

    .sec-label {
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      color: #9ca3af;
      margin: 24px 0 10px;
    }
    .sec-label:first-child { margin-top: 0; }

    /* Segmented CDI/CDD */
    .seg {
      display: inline-flex;
      background: #f3f4f6;
      border-radius: 8px;
      padding: 3px;
      margin-bottom: 14px;
    }
    .seg button {
      background: transparent; border: none;
      border-radius: 6px; padding: 6px 22px;
      font-size: 14px; font-weight: 500; cursor: pointer; color: #6b7280;
      transition: all .15s;
    }
    .seg button.active { background: white; color: #111827; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

    /* Fields */
    .field { margin-bottom: 12px; }
    .field label { display: block; font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 4px; }
    .field input, .field select {
      width: 100%; box-sizing: border-box;
      border: 1px solid #e5e7eb; border-radius: 6px;
      padding: 8px 10px; font-size: 14px; color: #111827;
      background: white; outline: none;
      transition: border-color .15s;
    }
    .field input:focus, .field select:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.07); }
    .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

    /* Employee card */
    .emp-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 14px;
    }
    .emp-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 14px;
    }
    .ef-label { font-size: 10px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .ef-val   { font-weight: 600; color: #111827; font-size: 13px; margin-top: 1px; }

    /* Clauses list */
    .clauses-list { display: flex; flex-direction: column; gap: 6px; }
    .clause-row {
      border: 1px solid #e5e7eb; border-radius: 8px;
      padding: 10px 12px; cursor: pointer;
      display: flex; justify-content: space-between; align-items: flex-start;
      transition: border-color .15s, background .15s;
    }
    .clause-row:hover { border-color: #93c5fd; background: #f0f7ff; }
    .cl-left { flex: 1; min-width: 0; padding-right: 10px; }
    .cl-title { font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 2px; }
    .cl-snip  { font-size: 11px; color: #9ca3af; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cl-mod   { font-size: 12px; color: #2563eb; font-weight: 500; flex-shrink: 0; }

    /* ── Right panel (aperçu A4) ── */
    .right {
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      background: #EDEFF2;
      padding: 28px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative; /* pour le bouton scroll-top */
    }
    .right > app-contracts-a4-preview {
      width: 100%;
      max-width: 794px;
    }

    /* ── Bouton retour en haut — visible seulement dans le panneau A4 ── */
    .scroll-top-btn {
      position: sticky;
      bottom: 16px;
      align-self: flex-end;
      margin-right: 4px;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: none;
      background: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.18);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      color: #374151;
      opacity: 0;
      pointer-events: none;
      transition: opacity .2s, box-shadow .2s;
      z-index: 5;
    }
    .scroll-top-btn.visible {
      opacity: 1;
      pointer-events: auto;
    }
    .scroll-top-btn:hover {
      background: #f9fafb;
      box-shadow: 0 4px 12px rgba(0,0,0,0.22);
    }

    /* ── Preview modal ── */
    .prev-overlay {
      position: fixed; inset: 0;
      background: rgba(17,24,39,0.65);
      z-index: 1100;
      display: flex; align-items: center; justify-content: center;
      padding: 24px;
    }
    .prev-modal {
      background: white; border-radius: 12px;
      width: 900px; max-width: 96vw;
      max-height: calc(100vh - 48px);
      display: flex; flex-direction: column;
      overflow: hidden;
      box-shadow: 0 24px 64px rgba(0,0,0,0.25);
    }
    .prev-head {
      flex: 0 0 auto;
      padding: 18px 28px;
      border-bottom: 1px solid #e5e7eb;
      display: flex; justify-content: space-between; align-items: flex-start;
    }
    .prev-head h3 { margin: 0; font-size: 16px; font-weight: 700; color: #111827; }
    .prev-head p  { margin: 4px 0 0; font-size: 13px; color: #6b7280; }
    .prev-body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      background: #EDEFF2;
      padding: 28px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .prev-body > app-contracts-a4-preview {
      width: 100%;
      max-width: 794px;
    }
    .prev-foot {
      flex: 0 0 auto;
      padding: 14px 28px;
      border-top: 1px solid #e5e7eb;
      display: flex; justify-content: flex-end; gap: 10px;
      background: white;
    }
    .btn-close {
      background: white; border: 1px solid #e5e7eb; border-radius: 8px;
      padding: 9px 20px; font-size: 14px; font-weight: 500; cursor: pointer; color: #374151;
    }
    .btn-close:hover { background: #f9fafb; }
    .btn-pdf {
      background: #2563eb; color: white; border: none; border-radius: 8px;
      padding: 9px 22px; font-size: 14px; font-weight: 600; cursor: pointer;
    }
    .btn-pdf:hover { background: #1d4ed8; }

    /* Toast notification */
    .toast {
      position: fixed;
      top: 16px;
      right: 20px;
      z-index: 2000;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 14px rgba(0,0,0,0.15);
      animation: slideIn .2s ease;
    }
    .toast-ok  { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
    .toast-err { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    @keyframes slideIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }

    /* Lecture seule / double génération */
    .banner-readonly {
      background: #fffbeb;
      border: 1px solid #fcd34d;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 14px;
      font-size: 13px;
      color: #92400e;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .banner-already {
      background: #fef2f2;
      border: 1px solid #fca5a5;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 14px;
      font-size: 13px;
      color: #991b1b;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn-list { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 16px; font-size: 14px; font-weight: 500; cursor: pointer; color: #374151; white-space: nowrap; }
    .btn-list:hover { background: #f9fafb; }
    .btn-dl   { background: #059669; color: white; border: none; border-radius: 8px; padding: 8px 16px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .btn-dl:hover { background: #047857; }
  `],
  template: `
    <!-- ── Toast feedback ── -->
    <div class="toast" *ngIf="toastMsg" [class.toast-ok]="toastOk" [class.toast-err]="!toastOk">
      {{ toastMsg }}
    </div>

    <!-- ── Top bar ── -->
    <div class="topbar">
      <div class="breadcrumb">
        <button class="bc-link" (click)="router.navigate(['/contracts'])">Contrats RH</button>
        <span class="bc-sep">/</span>
        <span class="bc-curr">{{ isEdit ? (isGenerated ? 'Contrat généré' : 'Modifier le contrat') : 'Nouveau contrat' }}</span>
        <span class="badge-draft" *ngIf="!contractId && !isGenerated">Brouillon</span>
        <span class="badge-draft" *ngIf="contractId && !isGenerated">Brouillon</span>
        <span class="badge-draft" *ngIf="isGenerated" style="background:#d1fae5;color:#065f46">Généré</span>
      </div>
      <div class="topbar-actions">
        <!-- Mode GENERE : lecture seule -->
        <ng-container *ngIf="isGenerated">
          <button class="btn-list" (click)="router.navigate(['/contracts'])">← Retour à la liste</button>
          <button class="btn-dl" (click)="downloadGenerated()">⬇ Télécharger PDF</button>
        </ng-container>
        <!-- Mode BROUILLON ou Nouveau -->
        <ng-container *ngIf="!isGenerated">
          <button class="btn-prev" (click)="showPreview = true">Prévisualiser</button>
          <button class="btn-save" (click)="save()" [disabled]="form.invalid || saving">
            {{ saving ? 'Enregistrement…' : 'Enregistrer brouillon' }}
          </button>
          <button class="btn-gen" (click)="generatePdf()" [disabled]="form.invalid || saving || !!existingGeneratedContract">
            {{ generating ? 'Génération…' : 'Générer PDF' }}
          </button>
        </ng-container>
      </div>
    </div>

    <!-- ── Body: left form / right A4 ── -->
    <div class="body">

      <!-- LEFT -->
      <div class="left">
        <div class="left-inner">
          <form [formGroup]="form">

            <!-- TYPE & EMPLOYÉ -->
            <div class="sec-label">Type et Employé</div>

            <!-- Banner lecture seule si contrat GENERE ouvert -->
            <div class="banner-readonly" *ngIf="isGenerated">
              <span>🔒</span>
              <span>Ce contrat a déjà été généré. Il n'est pas modifiable.</span>
            </div>

            <div class="seg" *ngIf="!isGenerated">
              <button type="button" [class.active]="form.value.type==='CDI'" (click)="setType('CDI')">CDI</button>
              <button type="button" [class.active]="form.value.type==='CDD'" (click)="setType('CDD')">CDD</button>
            </div>
            <div *ngIf="isGenerated" style="margin-bottom:10px">
              <span class="badge-type" style="display:inline-block;padding:2px 10px;background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;border-radius:4px;font-size:13px;font-weight:600">{{ form.value.type }}</span>
            </div>

            <div class="field" *ngIf="!isEdit">
              <label>Employé *</label>
              <select formControlName="employeeId" (change)="onEmployeeChange()">
                <option value="">-- Choisir un employé --</option>
                <option *ngFor="let u of employees" [value]="u.id">
                  {{ u.prenom }} {{ u.nom }} ({{ u.matricule || 'N/A' }})
                </option>
              </select>
            </div>

            <!-- Banner double génération (nouveau contrat) -->
            <div class="banner-already" *ngIf="existingGeneratedContract && !isEdit">
              <span>⚠️</span>
              <span>Un contrat généré existe déjà pour cet employé.</span>
            </div>

            <!-- Fiche employé -->
            <div class="emp-card" *ngIf="empSnap.employeeFullName">
              <div class="emp-grid">
                <div>
                  <div class="ef-label">Nom complet</div>
                  <div class="ef-val">{{ empSnap.employeeFullName }}</div>
                </div>
                <div>
                  <div class="ef-label">Matricule</div>
                  <div class="ef-val">{{ empSnap.employeeMatricule || '—' }}</div>
                </div>
                <div>
                  <div class="ef-label">CIN</div>
                  <div class="ef-val">{{ empSnap.employeeCin || '—' }}</div>
                </div>
                <div>
                  <div class="ef-label">Poste</div>
                  <div class="ef-val">{{ empSnap.employeePoste || '—' }}</div>
                </div>
                <div>
                  <div class="ef-label">Département</div>
                  <div class="ef-val">{{ empSnap.employeeDepartement || '—' }}</div>
                </div>
                <div>
                  <div class="ef-label">Date d'embauche</div>
                  <div class="ef-val">{{ empSnap.employeeHireDate || '—' }}</div>
                </div>
                <div style="grid-column:1/-1">
                  <div class="ef-label">Email</div>
                  <div class="ef-val">{{ empSnap.employeeEmail || '—' }}</div>
                </div>
              </div>
            </div>

            <!-- INFORMATIONS CONTRAT -->
            <div class="sec-label">Informations Contrat</div>

            <div class="g2">
              <div class="field">
                <label>Date de début *</label>
                <input type="date" formControlName="startDate" />
              </div>
              <div class="field" *ngIf="form.value.type === 'CDD'">
                <label>Date de fin *</label>
                <input type="date" formControlName="endDate" />
              </div>
            </div>

            <div class="g2">
              <div class="field">
                <label>Lieu de travail</label>
                <input type="text" formControlName="workplace" placeholder="ex : Casablanca" />
              </div>
              <div class="field">
                <label>Lieu de signature</label>
                <input type="text" formControlName="signaturePlace" />
              </div>
            </div>

            <div class="g2">
              <div class="field">
                <label>Date de signature</label>
                <input type="date" formControlName="signatureDate" />
              </div>
            </div>

            <div class="g2">
              <div class="field">
                <label>Période d'essai</label>
                <input type="text" formControlName="trialPeriod" placeholder="ex : 1 mois" />
              </div>
              <div class="field">
                <label>Préavis</label>
                <input type="text" formControlName="noticePeriod" placeholder="ex : 8 jours" />
              </div>
            </div>

            <!-- RÉMUNÉRATION -->
            <div class="sec-label">Rémunération</div>

            <div class="g2">
              <div class="field">
                <label>Salaire de base mensuel (DH)</label>
                <input type="number" formControlName="baseSalary" placeholder="0" />
              </div>
              <div class="field">
                <label>Prime fixe mensuelle (DH)</label>
                <input type="number" formControlName="fixedBonus" placeholder="0" />
              </div>
            </div>

            <!-- CLAUSES -->
            <div class="sec-label">Clauses Personnalisables</div>
            <div class="clauses-list">
              <div class="clause-row" *ngFor="let cl of clauses; let i = index" (click)="openModal(i)">
                <div class="cl-left">
                  <div class="cl-title">{{ cl.title }}</div>
                  <div class="cl-snip">{{ snippet(cl.html) }}</div>
                </div>
                <span class="cl-mod">Modifier</span>
              </div>
            </div>

          </form>
        </div>
      </div>

      <!-- RIGHT: Live A4 preview -->
      <div class="right" #rightPanel (scroll)="onRightScroll($event)">
        <app-contracts-a4-preview [data]="previewData" [clauses]="clauses"></app-contracts-a4-preview>
        <button class="scroll-top-btn" [class.visible]="showScrollTop"
                (click)="scrollRightToTop()" title="Retour en haut" aria-label="Retour en haut">
          &#8679;
        </button>
      </div>
    </div>

    <!-- Clause modal -->
    <app-contracts-clause-modal
      *ngIf="modalOpen"
      [isOpen]="modalOpen"
      [clauseTitle]="clauses[modalIdx] ? clauses[modalIdx].title : ''"
      [content]="clauses[modalIdx] ? clauses[modalIdx].html : ''"
      (apply)="onApply($event)"
      (cancel)="modalOpen = false">
    </app-contracts-clause-modal>

    <!-- Preview modal -->
    <div class="prev-overlay" *ngIf="showPreview" (click)="showPreview = false">
      <div class="prev-modal" (click)="$event.stopPropagation()">
        <div class="prev-head">
          <div>
            <h3>Prévisualisation du contrat</h3>
            <p>Lecture seule — vérifiez le rendu avant la génération du PDF.</p>
          </div>
        </div>
        <div class="prev-body">
          <app-contracts-a4-preview [data]="previewData" [clauses]="clauses"></app-contracts-a4-preview>
        </div>
        <div class="prev-foot">
          <button class="btn-close" (click)="showPreview = false">Fermer</button>
          <button class="btn-pdf"   (click)="generatePdf()">Générer PDF</button>
        </div>
      </div>
    </div>
  `
})
export class ContractsFormComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  isEdit = false;
  contractId?: number;
  saving = false;
  generating = false;
  showPreview = false;
  isGenerated = false;                      // true si le contrat chargé est GENERE
  existingGeneratedContract: any = null;    // contrat GENERE existant pour l'employé sélectionné
  private generatedContractData?: any;     // données du contrat GENERE (pour téléchargement)

  // Toast feedback
  toastMsg = '';
  toastOk = true;
  private toastTimer?: ReturnType<typeof setTimeout>;

  // Bouton retour en haut dans le panneau A4 droit
  showScrollTop = false;

  employees: any[] = [];

  /** Raw employee snapshot (does NOT include form values) */
  empSnap: any = {};

  /**
   * base clauses: templates with {{tokens}}
   * After user edits with Quill, tokens are replaced with real values in that clause.
   * refreshClauses() re-interpolates from these on each form change.
   */
  private baseClauses: Clause[] = [];

  /** Interpolated clauses — bound to the A4 preview and clause list */
  clauses: Clause[] = [];

  modalOpen = false;
  modalIdx = 0;

  private destroy$ = new Subject<void>();
  private formSub?: Subscription;

  @ViewChild('rightPanel') rightPanelRef?: ElementRef<HTMLElement>;

  constructor(
    private fb: FormBuilder,
    public router: Router,
    private route: ActivatedRoute,
    private http: HttpClient,
    private svc: ContractService
  ) { }

  ngOnInit() {
    this.form = this.fb.group({
      employeeId: ['', Validators.required],
      type: ['CDI', Validators.required],
      startDate: ['', Validators.required],
      endDate: [''],
      workplace: [''],
      signaturePlace: ['Casablanca'],
      signatureDate: [''],
      trialPeriod: ['1 mois'],
      noticePeriod: ['8 jours'],
      baseSalary: [null],
      fixedBonus: [null]
    });

    this.baseClauses = this.clone(CDI_DEFAULTS);
    this.refreshClauses();

    // React to every form change → live A4 update
    this.formSub = this.form.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.refreshClauses());

    this.http.get<any[]>(`${environment.apiUrl}/api/users`).subscribe(users => {
      this.employees = users.filter(u => {
        const r = u.role ? u.role.toUpperCase() : '';
        return r !== 'ADMIN' && r !== 'RH';
      });
      this.checkEdit();
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  // ── Reactive data for A4 component ──────────────────────────────────────────
  get previewData(): any {
    const fv = this.form.getRawValue();
    return {
      ...this.empSnap,
      type: fv.type,
      signaturePlace: fv.signaturePlace || 'Casablanca',
      signatureDate: fv.signatureDate ? fmtDate(fv.signatureDate) : '',
    };
  }

  // ── Clause interpolation ─────────────────────────────────────────────────────
  private buildVars(): Record<string, string> {
    const fv = this.form.getRawValue();
    return {
      employeeFullName: this.empSnap.employeeFullName ?? '',
      poste: this.empSnap.employeePoste ?? '',
      cin: this.empSnap.employeeCin ?? '',
      startDate: fv.startDate ? fmtDate(fv.startDate) : '',
      endDate: fv.endDate ? fmtDate(fv.endDate) : '',
      workplace: fv.workplace || '',
      trialPeriod: fv.trialPeriod || '',
      noticePeriod: fv.noticePeriod || '',
      baseSalary: fv.baseSalary ? fmtNum(fv.baseSalary) : '',
      fixedBonus: fv.fixedBonus ? fmtNum(fv.fixedBonus) : '',
    };
  }

  refreshClauses() {
    const vars = this.buildVars();
    this.clauses = this.baseClauses.map(cl => ({
      ...cl,
      html: interp(cl.html, vars)
    }));
  }

  // ── Type switch ──────────────────────────────────────────────────────────────
  setType(t: string) {
    this.form.get('type')!.setValue(t, { emitEvent: false });
    if (t === 'CDD') {
      this.form.get('endDate')!.setValidators(Validators.required);
    } else {
      this.form.get('endDate')!.clearValidators();
      this.form.get('endDate')!.setValue('', { emitEvent: false });
    }
    this.form.get('endDate')!.updateValueAndValidity({ emitEvent: false });

    this.baseClauses = this.clone(t === 'CDI' ? CDI_DEFAULTS : CDD_DEFAULTS);
    this.refreshClauses();
  }

  // ── Employee change ──────────────────────────────────────────────────────────
  onEmployeeChange() {
    const id = +this.form.value.employeeId;
    const emp = this.employees.find(e => e.id === id);
    if (!emp) {
      this.empSnap = {};
      this.existingGeneratedContract = null;
      this.refreshClauses();
      return;
    }

    // Update employee snapshot
    this.empSnap = {
      employeeFullName: `${emp.prenom} ${emp.nom}`,
      employeeMatricule: emp.matricule,
      employeeCin: emp.cin,
      employeePoste: emp.poste,
      employeeDepartement: emp.departement,
      employeeHireDate: emp.dateEmbauche,
      employeeEmail: emp.email
    };

    // Reset contract-specific fields (keep type and signaturePlace)
    this.form.patchValue({
      startDate: '',
      endDate: '',
      signatureDate: '',
      trialPeriod: '1 mois',
      noticePeriod: '8 jours',
      workplace: '',
      // signaturePlace stays 'Casablanca'
    }, { emitEvent: false });

    // Reset clauses for current type
    this.baseClauses = this.clone(
      this.form.value.type === 'CDI' ? CDI_DEFAULTS : CDD_DEFAULTS
    );

    // Vérifier si un contrat GENERE existe déjà pour cet employé
    this.svc.list(undefined, 'GENERE' as any, id).subscribe({
      next: contracts => {
        this.existingGeneratedContract = contracts.length > 0 ? contracts[0] : null;
      },
      error: () => { this.existingGeneratedContract = null; }
    });

    // Fetch salary from payroll profile
    this.svc.getPayrollProfile(id).subscribe({
      next: p => {
        this.form.patchValue({
          baseSalary: p.baseSalary,
          fixedBonus: p.fixedBonus
        }, { emitEvent: false });
        this.refreshClauses();
      },
      error: () => this.refreshClauses()
    });
  }

  // ── Load edit mode ───────────────────────────────────────────────────────────
  checkEdit() {
    const p = this.route.snapshot.paramMap.get('id');
    if (!p || p === 'new') return;

    this.isEdit = true;
    this.contractId = +p;

    this.svc.getById(this.contractId).subscribe(c => {
      // Détecter si le contrat est GENERE → lecture seule
      this.isGenerated = (c.status as string) === 'GENERE';
      this.generatedContractData = c;

      this.form.patchValue({
        employeeId: c.employeeId,
        type: c.type,
        startDate: c.startDate,
        endDate: c.endDate,
        workplace: c.workplace,
        signaturePlace: c.signaturePlace,
        signatureDate: c.signatureDate,
        trialPeriod: c.trialPeriod,
        noticePeriod: c.noticePeriod,
        baseSalary: c.baseSalary,
        fixedBonus: c.fixedBonus
      }, { emitEvent: false });

      // Désactiver le formulaire si GENERE
      if (this.isGenerated) {
        this.form.disable({ emitEvent: false });
      }

      this.empSnap = {
        employeeFullName: c.employeeFullName,
        employeeMatricule: c.employeeMatricule,
        employeeCin: c.employeeCin,
        employeePoste: c.employeePoste,
        employeeDepartement: c.employeeDepartement,
        employeeHireDate: c.employeeHireDate,
        employeeEmail: c.employeeEmail
      };

      // Restaurer les clauses-sources avec tokens depuis formDataJson.
      // clausesJson contient des valeurs déjà interpolées → ne pas l'utiliser comme source.
      try {
        if (c.formDataJson) {
          const parsed = JSON.parse(c.formDataJson);
          if (parsed && Array.isArray(parsed.baseClauses) && parsed.baseClauses.length > 0) {
            // Clauses sources avec tokens : le formulaire peut ré-interpoler correctement
            this.baseClauses = parsed.baseClauses;
          } else {
            // formDataJson présent mais sans baseClauses valides → fallback defaults
            this.baseClauses = this.clone(c.type === 'CDI' ? CDI_DEFAULTS : CDD_DEFAULTS);
          }
        } else {
          // Ancien brouillon sans formDataJson → fallback defaults
          // (l'utilisateur perdra les éditions Quill sur clauses modifiées,
          //  mais les tokens seront bien présents pour ré-interpoler)
          this.baseClauses = this.clone(c.type === 'CDI' ? CDI_DEFAULTS : CDD_DEFAULTS);
        }
      } catch {
        this.baseClauses = this.clone(c.type === 'CDI' ? CDI_DEFAULTS : CDD_DEFAULTS);
      }
      this.refreshClauses();
    });
  }

  // ── Téléchargement contrat GENERE ───────────────────────────────────────────
  downloadGenerated() {
    if (!this.generatedContractData) return;
    const c = this.generatedContractData;
    if (c.pdfUrl) {
      this.svc.openPdf(c.pdfUrl);
    } else if (c.id) {
      this.svc.downloadPdfById(c.id);
    }
  }

  // ── Quill modal ──────────────────────────────────────────────────────────────
  openModal(i: number) { this.modalIdx = i; this.modalOpen = true; }

  onApply(html: string) {
    // Update baseClauses[i] with user-edited HTML (tokens replaced by real text)
    this.baseClauses[this.modalIdx] = { ...this.baseClauses[this.modalIdx], html };
    this.refreshClauses();
    this.modalOpen = false;
  }

  snippet(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return (div.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 90);
  }

  // ── Toast helper ────────────────────────────────────────────────────────────
  private showToast(msg: string, ok = true) {
    this.toastMsg = msg;
    this.toastOk = ok;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toastMsg = ''; }, 3500);
  }

  // ── Build save DTO ──────────────────────────────────────────────────────────
  private buildDto(): ContractCreateDto {
    const fv = this.form.getRawValue();
    return {
      type: fv.type,
      employeeId: fv.employeeId ? +fv.employeeId : this.empSnap.employeeId,
      employeeFullName: this.empSnap.employeeFullName,
      employeeMatricule: this.empSnap.employeeMatricule,
      employeeCin: this.empSnap.employeeCin,
      employeePoste: this.empSnap.employeePoste,
      employeeDepartement: this.empSnap.employeeDepartement,
      employeeEmail: this.empSnap.employeeEmail,
      employeeHireDate: this.empSnap.employeeHireDate,
      startDate: fv.startDate || undefined,
      endDate: fv.endDate || undefined,
      workplace: fv.workplace || undefined,
      signaturePlace: fv.signaturePlace || undefined,
      signatureDate: fv.signatureDate || undefined,
      trialPeriod: fv.trialPeriod || undefined,
      noticePeriod: fv.noticePeriod || undefined,
      baseSalary: fv.baseSalary ?? undefined,
      fixedBonus: fv.fixedBonus ?? undefined,
      // Rendu final interpolé (pour le PDF backend)
      clausesJson: JSON.stringify(this.clauses),
      // Clauses sources avec tokens {{...}} (pour ré-interpoler à l'édition)
      formDataJson: JSON.stringify({ baseClauses: this.baseClauses }),
    };
  }

  // ── Enregistrer brouillon ───────────────────────────────────────────────────
  save(silent = false): Promise<number> {
    return new Promise((resolve, reject) => {
      if (this.form.invalid) { reject('form invalid'); return; }
      this.saving = true;
      const dto = this.buildDto();

      const obs = this.isEdit && this.contractId
        ? this.svc.update(this.contractId, dto)
        : this.svc.createDraft(dto);

      obs.subscribe({
        next: c => {
          this.contractId = c.id;
          this.isEdit = true;
          this.saving = false;
          if (!silent) {
            this.router.navigate(['/contracts'], { state: { toast: 'Brouillon enregistré avec succès ✓' } });
          }
          resolve(c.id);
        },
        error: err => {
          this.saving = false;
          this.showToast('Erreur lors de la sauvegarde', false);
          reject(err);
        }
      });
    });
  }

  // ── Générer PDF ─────────────────────────────────────────────────────────────
  async generatePdf() {
    if (this.generating) return;
    // Ne jamais générer si un contrat GENERE existe déjà pour cet employé
    if (this.existingGeneratedContract) return;
    this.generating = true;

    try {
      // 1. Sauvegarder silencieusement (pas de toast "Brouillon enregistré")
      await this.save(true);

      // 2. Appel génération backend
      this.svc.generate(this.contractId!).subscribe({
        next: () => {
          this.generating = false;
          // Rediriger vers la liste avec un état de succès
          this.router.navigate(['/contracts'], { state: { toast: 'Contrat généré avec succès ✓' } });
        },
        error: () => {
          this.generating = false;
          this.showToast('Erreur lors de la génération PDF', false);
        }
      });
    } catch {
      this.generating = false;
      // save() a déjà affiché le toast d'erreur
    }
  }

  private clone<T>(arr: T[]): T[] { return JSON.parse(JSON.stringify(arr)); }

  // ── Bouton retour en haut du panneau A4 ────────────────────────────────────
  onRightScroll(event: Event) {
    const el = event.target as HTMLElement;
    this.showScrollTop = el.scrollTop > 150;
  }

  scrollRightToTop() {
    this.rightPanelRef?.nativeElement.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
