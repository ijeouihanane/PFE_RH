import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIf } from '@angular/common';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  selector: 'app-change-password',
  imports: [ReactiveFormsModule, NgIf],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.scss',
})
export class ChangePasswordComponent {
  error: string | null = null;

  form = this.fb.nonNullable.group({
    ancien: ['', [Validators.required]],
    nouveau: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  submit(): void {
    this.error = null;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.auth.changePassword(v.ancien, v.nouveau).subscribe({
      next: () => void this.router.navigateByUrl('/dashboard'),
      error: () => {
        this.error = 'Impossible de changer le mot de passe (ancien mot de passe incorrect ?).';
      },
    });
  }
}
