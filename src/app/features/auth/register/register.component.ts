import { Component, inject } from '@angular/core';
import { I18nService, TranslatePipe } from 'taxon-shared';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

// Mismas reglas que valida auth_backend (src/controllers/auth.js post_register):
// 6-12 caracteres, mayúscula, minúscula, dígito, sin espacios.
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)\S{6,12}$/;

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  private readonly i18n = inject(I18nService);
  submitting = false;
  showPassword = false;
  errorMessage: string | null = null;
  success = false;
  form: FormGroup;

  constructor(private fb: FormBuilder, private auth: AuthService) {
    this.form = this.fb.group({
      nombre: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      procedencia: [''],
      password: ['', [Validators.required, Validators.pattern(PASSWORD_PATTERN)]],
      aviso: [false, [Validators.requiredTrue]],
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.errorMessage = null;

    const { nombre, email, procedencia, password, aviso } = this.form.getRawValue();

    this.auth
      .register({ nombre: nombre!, email: email!, procedencia: procedencia ?? '', password: password!, aviso: aviso! })
      .subscribe({
        next: () => {
          this.submitting = false;
          this.success = true;
        },
        error: (msg) => {
          this.submitting = false;
          this.errorMessage = typeof msg === 'string' ? msg : this.i18n.t('auth.register.error');
        },
      });
  }
}
