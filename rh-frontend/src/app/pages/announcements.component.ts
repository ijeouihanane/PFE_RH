import { DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IIconComponent } from '../core/i-icon.component';
import { AuthService } from '../core/auth.service';
import { environment } from '../../environments/environment';

type Announcement = {
  id: number;
  titre: string;
  contenu: string;
  fichierUrl?: string | null;
  publiePar: number;
  publieAt: string;
  actif: boolean;
  epinglee: boolean;
};

@Component({
  standalone: true,
  selector: 'app-announcements',
  imports: [NgIf, NgFor, NgClass, ReactiveFormsModule, DatePipe, IIconComponent],
  templateUrl: './announcements.component.html',
  styleUrl: './announcements.component.scss',
})
export class AnnouncementsComponent implements OnInit {
  announcements: Announcement[] = [];
  users: any[] = [];
  selectedFile: File | null = null;
  today = new Date();
  search = '';
  statusFilter = 'ALL';
  audienceFilter = 'ALL';
  isPublishing = false;
  error: string | null = null;
  success: string | null = null;

  form = this.fb.nonNullable.group({
    titre: ['', Validators.required],
    contenu: ['', Validators.required],
    epinglee: [false],
  });

  constructor(
    readonly auth: AuthService,
    private readonly http: HttpClient,
    private readonly fb: FormBuilder,
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.error = null;
    this.http.get<Announcement[]>(`${environment.apiUrl}/api/documents/announcements`).subscribe({
      next: items => this.announcements = items || [],
      error: e => this.error = e?.error?.error ?? 'Impossible de charger les annonces.',
    });
    if (this.isRh) {
      this.http.get<any[]>(`${environment.apiUrl}/api/users`).subscribe({
        next: users => this.users = users || [],
        error: () => this.users = [],
      });
    }
  }

  get isRh(): boolean {
    return this.auth.user?.role === 'RH';
  }

  get publishedCount(): number {
    return this.announcements.filter(a => a.actif).length;
  }

  get pinnedCount(): number {
    return this.announcements.filter(a => a.actif && a.epinglee).length;
  }

  get archivedCount(): number {
    return this.announcements.filter(a => !a.actif).length;
  }

  get filteredAnnouncements(): Announcement[] {
    const q = this.search.trim().toLowerCase();
    return this.announcements.filter(a => {
      const matchesSearch = !q || `${a.titre} ${a.contenu}`.toLowerCase().includes(q);
      const matchesStatus =
        this.statusFilter === 'ALL' ||
        (this.statusFilter === 'PUBLISHED' && a.actif) ||
        (this.statusFilter === 'ARCHIVED' && !a.actif) ||
        (this.statusFilter === 'PINNED' && a.epinglee);
      const matchesAudience =
        this.audienceFilter === 'ALL' ||
        (this.audienceFilter === 'RECENT' && this.isNew(a)) ||
        (this.audienceFilter === 'ATTACHED' && !!a.fichierUrl);
      return matchesSearch && matchesStatus && matchesAudience;
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] || null;
  }

  clearFile(): void {
    this.selectedFile = null;
  }

  publish(): void {
    this.error = null;
    this.success = null;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isPublishing = true;
    const payload = {
      ...this.form.getRawValue(),
      type: 'ANNONCE',
      categorie: '',
    };
    this.http.post<Announcement>(`${environment.apiUrl}/api/documents`, payload).subscribe({
      next: created => {
        if (!this.selectedFile) {
          this.finishPublish();
          return;
        }
        const fd = new FormData();
        fd.append('file', this.selectedFile);
        this.http.post(`${environment.apiUrl}/api/documents/${created.id}/file`, fd).subscribe({
          next: () => this.finishPublish(),
          error: () => {
            this.error = "Annonce créée, mais l'upload de la pièce jointe a échoué.";
            this.isPublishing = false;
            this.reload();
          },
        });
      },
      error: e => {
        this.error = e?.error?.error ?? "Erreur lors de la publication de l'annonce.";
        this.isPublishing = false;
      },
    });
  }

  private finishPublish(): void {
    this.success = 'Annonce publiée avec succès.';
    this.form.reset({ titre: '', contenu: '', epinglee: false });
    this.selectedFile = null;
    this.isPublishing = false;
    this.reload();
  }

  setPinned(item: Announcement, pinned: boolean): void {
    this.http.patch<Announcement>(`${environment.apiUrl}/api/documents/announcements/${item.id}/pin`, { epinglee: pinned })
      .subscribe(() => this.reload());
  }

  toggleArchive(item: Announcement): void {
    const action = item.actif ? 'archive' : 'unarchive';
    this.http.patch(`${environment.apiUrl}/api/documents/announcements/${item.id}/${action}`, {})
      .subscribe(() => this.reload());
  }

  delete(item: Announcement): void {
    if (!confirm('Supprimer définitivement cette annonce ?')) return;
    this.http.delete(`${environment.apiUrl}/api/documents/${item.id}`).subscribe(() => this.reload());
  }

  authorName(id: number): string {
    const u = this.users.find(x => x.id === id);
    if (u) return `${u.prenom} ${u.nom}`;
    const current = this.auth.user;
    if (current?.id === id) return `${current.prenom} ${current.nom}`;
    return 'RH';
  }

  fileUrl(path?: string | null): string {
    if (!path) return '#';
    return path.startsWith('http') ? path : `${environment.apiUrl}${path}`;
  }

  fileName(path?: string | null): string {
    if (!path) return '';
    return decodeURIComponent(path.split('/').pop() || 'Pièce jointe');
  }

  isNew(item: Announcement): boolean {
    const published = new Date(item.publieAt).getTime();
    if (Number.isNaN(published)) return false;
    return Date.now() - published < 7 * 24 * 60 * 60 * 1000;
  }
}
