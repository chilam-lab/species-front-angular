import { Component, inject } from '@angular/core';
import { I18nService, TranslatePipe } from 'taxon-shared';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss']
})
export class ForgotPasswordComponent {
  private readonly i18n = inject(I18nService);
  form: FormGroup;
  submitting = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;

  constructor(private auth: AuthService, private fb: FormBuilder) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.successMessage = null;
    this.errorMessage = null;

    const { email } = this.form.getRawValue();

    this.auth.recoverPassword(email!).subscribe({
      next: () => {
        this.submitting = false;
        this.successMessage = this.i18n.t('auth.forgot.success');
      },
      error: (msg) => {
        this.submitting = false;
        this.errorMessage = typeof msg === 'string' ? msg : this.i18n.t('auth.forgot.error');
      },
    });
  }
}
