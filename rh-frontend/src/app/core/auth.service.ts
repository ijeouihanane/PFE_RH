import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { LoginResponse, User } from './models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenKey = 'rh_token';
  private readonly userKey = 'rh_user';

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
  ) {}

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/api/auth/login`, { email, password })
      .pipe(
        tap((res) => {
          localStorage.setItem(this.tokenKey, res.token);
          localStorage.setItem(this.userKey, JSON.stringify(res.user));
        }),
      );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    void this.router.navigateByUrl('/login');
  }

  get token(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  get user(): User | null {
    const raw = localStorage.getItem(this.userKey);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }

  isLoggedIn(): boolean {
    return !!this.token;
  }

  changePassword(ancien: string, nouveau: string): Observable<void> {
    return this.http
      .post<void>(`${environment.apiUrl}/api/users/me/change-password`, {
        ancienMotDePasse: ancien,
        nouveauMotDePasse: nouveau,
      })
      .pipe(
        tap(() => {
          const u = this.user;
          if (u) {
            u.firstLogin = false;
            localStorage.setItem(this.userKey, JSON.stringify(u));
          }
        }),
      );
  }
}
