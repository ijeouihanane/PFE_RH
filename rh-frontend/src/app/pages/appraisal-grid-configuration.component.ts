import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideArrowDown,
  LucideArrowLeft,
  LucideArrowUp,
  LucideBuilding2,
  LucideCheck,
  LucideChevronLeft,
  LucideEye,
  LucideFileText,
  LucideGrid2X2,
  LucideHistory,
  LucideInfo,
  LucideListChecks,
  LucidePencil,
  LucidePlus,
  LucideSearch,
  LucideTrash2,
  LucideX,
} from '@lucide/angular';
import { forkJoin } from 'rxjs';
import { GridCriterion, GridDetail, GridSummary, PublishGridPayload } from './appraisal-grid.model';
import { AppraisalGridService } from './appraisal-grid.service';

type GridFilter = 'ALL' | 'SPECIFIC' | 'GENERIC';
type ScreenMode = 'LIST' | 'EDIT' | 'CREATE';
type DrawerMode = 'VERSIONS' | 'DETAIL';

@Component({
  standalone: true,
  selector: 'app-appraisal-grid-configuration',
  imports: [
    CommonModule,
    FormsModule,
    LucideArrowDown,
    LucideArrowLeft,
    LucideArrowUp,
    LucideBuilding2,
    LucideCheck,
    LucideChevronLeft,
    LucideEye,
    LucideFileText,
    LucideGrid2X2,
    LucideHistory,
    LucideInfo,
    LucideListChecks,
    LucidePencil,
    LucidePlus,
    LucideSearch,
    LucideTrash2,
    LucideX,
  ],
  templateUrl: './appraisal-grid-configuration.component.html',
  styleUrl: './appraisal-grid-configuration.component.scss',
})
export class AppraisalGridConfigurationComponent implements OnInit, OnDestroy {
  rows: GridSummary[] = [];
  availableDepartments: string[] = [];
  searchText = '';
  activeFilter: GridFilter = 'ALL';
  mode: ScreenMode = 'LIST';
  loading = true;
  saving = false;
  error: string | null = null;
  toast: { title: string; message: string } | null = null;

  source: GridDetail | null = null;
  form = { department: '', label: '', criteria: [] as GridCriterion[] };
  confirmOpen = false;

  drawerOpen = false;
  drawerMode: DrawerMode = 'VERSIONS';
  drawerGrid: GridSummary | null = null;
  versions: GridSummary[] = [];
  viewedVersion: GridDetail | null = null;
  drawerLoading = false;

  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly service: AppraisalGridService) {}

  ngOnInit(): void {
    this.reload();
  }

  ngOnDestroy(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  get filteredRows(): GridSummary[] {
    const query = this.searchText.trim().toLowerCase();
    const filtered = this.rows.filter(row => {
      const matchesFilter = this.activeFilter === 'ALL'
        || (this.activeFilter === 'SPECIFIC' && !row.generic)
        || (this.activeFilter === 'GENERIC' && row.generic);
      const haystack = `${row.department ?? 'Autres départements'} ${row.label}`.toLowerCase();
      return matchesFilter && (!query || haystack.includes(query));
    });
    return filtered.sort((a, b) => {
      if (a.generic && !b.generic) return 1;
      if (!a.generic && b.generic) return -1;
      return (a.department || '').localeCompare(b.department || '');
    });
  }

  get activeGridCount(): number {
    return this.rows.filter(row => row.active).length;
  }

  get coveredDepartmentCount(): number {
    return this.rows.filter(row => !row.generic && row.active).length;
  }

  get activeCriterionCount(): number {
    return this.rows.filter(row => row.active).reduce((sum, row) => sum + row.criterionCount, 0);
  }

  get genericGrid(): GridSummary | undefined {
    return this.rows.find(row => row.generic && row.active);
  }

  get nextVersion(): number {
    return this.mode === 'CREATE' ? 1 : (this.source?.version ?? 0) + 1;
  }

  get formValid(): boolean {
    return !!this.form.department
      && !!this.form.label.trim()
      && this.form.criteria.length >= 2
      && this.form.criteria.length <= 10
      && this.form.criteria.every(item => !!item.label.trim() && !!item.description.trim());
  }

  reload(): void {
    this.loading = true;
    this.error = null;
    forkJoin({
      rows: this.service.list(),
      departments: this.service.availableDepartments(),
    }).subscribe({
      next: result => {
        this.rows = result.rows;
        this.availableDepartments = result.departments;
        this.loading = false;
      },
      error: error => {
        this.error = this.apiError(error, 'Chargement des grilles impossible.');
        this.loading = false;
      },
    });
  }

  configure(row: GridSummary): void {
    this.loading = true;
    this.service.detail(row.id).subscribe({
      next: detail => {
        this.source = detail;
        this.form = {
          department: detail.department ?? 'Autres départements',
          label: detail.label,
          criteria: detail.criteria.map(item => ({ ...item })),
        };
        this.mode = 'EDIT';
        this.loading = false;
      },
      error: error => {
        this.error = this.apiError(error, 'Chargement de la grille impossible.');
        this.loading = false;
      },
    });
  }

  create(): void {
    if (!this.availableDepartments.length) {
      this.showToast('Tous les départements sont couverts', 'Aucune nouvelle grille départementale n’est nécessaire.');
      return;
    }
    const generic = this.genericGrid;
    if (!generic) {
      this.error = 'La grille générique est indisponible.';
      return;
    }
    this.loading = true;
    this.service.detail(generic.id).subscribe({
      next: detail => {
        this.source = null;
        this.form = {
          department: this.availableDepartments[0],
          label: `Grille ${this.availableDepartments[0]}`,
          criteria: detail.criteria.map(item => ({ ...item, id: undefined })),
        };
        this.mode = 'CREATE';
        this.loading = false;
      },
      error: error => {
        this.error = this.apiError(error, 'Chargement de la grille générique impossible.');
        this.loading = false;
      },
    });
  }

  departmentChanged(): void {
    if (this.mode === 'CREATE') {
      this.form.label = `Grille ${this.form.department}`;
    }
  }

  cancelEditor(): void {
    this.mode = 'LIST';
    this.source = null;
    this.confirmOpen = false;
  }

  addCriterion(): void {
    if (this.form.criteria.length >= 10) return;
    this.form.criteria.push({
      label: '',
      description: '',
      displayOrder: this.form.criteria.length + 1,
    });
  }

  removeCriterion(index: number): void {
    if (this.form.criteria.length <= 2) return;
    this.form.criteria.splice(index, 1);
    this.reindex();
  }

  moveCriterion(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= this.form.criteria.length) return;
    [this.form.criteria[index], this.form.criteria[target]] =
      [this.form.criteria[target], this.form.criteria[index]];
    this.reindex();
  }

  requestPublish(): void {
    if (this.formValid && !this.saving) this.confirmOpen = true;
  }

  publish(): void {
    if (!this.formValid || this.saving) return;
    this.saving = true;
    const payload: PublishGridPayload = {
      department: this.form.department,
      label: this.form.label.trim(),
      expectedVersion: this.source?.version ?? null,
      criteria: this.form.criteria.map(item => ({
        label: item.label.trim(),
        description: item.description.trim(),
      })),
    };
    const request = this.mode === 'CREATE'
      ? this.service.create(payload)
      : this.service.publishVersion(this.source!.id, payload);
    request.subscribe({
      next: detail => {
        this.saving = false;
        this.confirmOpen = false;
        this.mode = 'LIST';
        this.source = null;
        this.showToast(
          detail.version === 1 ? 'Grille départementale publiée' : 'Nouvelle version publiée',
          `${detail.label} version ${detail.version} est maintenant active.`,
        );
        this.reload();
      },
      error: error => {
        this.saving = false;
        this.confirmOpen = false;
        this.error = this.apiError(error, 'Publication impossible.');
      },
    });
  }

  openVersions(row: GridSummary): void {
    this.drawerOpen = true;
    this.drawerMode = 'VERSIONS';
    this.drawerGrid = row;
    this.viewedVersion = null;
    this.drawerLoading = true;
    this.service.versions(row.id).subscribe({
      next: versions => {
        this.versions = versions;
        this.drawerLoading = false;
      },
      error: error => {
        this.error = this.apiError(error, 'Historique indisponible.');
        this.closeDrawer();
      },
    });
  }

  viewVersion(version: GridSummary): void {
    this.drawerLoading = true;
    this.service.detail(version.id).subscribe({
      next: detail => {
        this.viewedVersion = detail;
        this.drawerMode = 'DETAIL';
        this.drawerLoading = false;
      },
      error: error => {
        this.error = this.apiError(error, 'Version indisponible.');
        this.drawerLoading = false;
      },
    });
  }

  closeDrawer(): void {
    this.drawerOpen = false;
    this.drawerGrid = null;
    this.viewedVersion = null;
    this.versions = [];
  }

  trackCriterion(_index: number, criterion: GridCriterion): GridCriterion {
    return criterion;
  }

  formatDate(value: string, long = false): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: long ? 'long' : 'short',
      year: 'numeric',
    }).format(new Date(value));
  }

  private reindex(): void {
    this.form.criteria.forEach((item, index) => item.displayOrder = index + 1);
  }

  private showToast(title: string, message: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast = { title, message };
    this.toastTimer = setTimeout(() => this.toast = null, 3600);
  }

  private apiError(error: any, fallback: string): string {
    return error?.error?.error ?? error?.error?.message ?? fallback;
  }
}
