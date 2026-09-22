import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss']
})
export class ForgotPasswordComponent {
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
        this.successMessage = 'Revisa tu correo: te enviamos una contraseña temporal.';
      },
      error: (msg) => {
        this.submitting = false;
        this.errorMessage = typeof msg === 'string' ? msg : 'No se pudo procesar la solicitud.';
      },
    });
  }
}
