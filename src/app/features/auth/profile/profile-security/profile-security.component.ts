import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { AuthService } from '../../../../core/auth/auth.service';

function passwordsMatchValidator(group: FormGroup): ValidationErrors | null {
  const newpassword = group.get('newpassword')?.value;
  const confirm = group.get('confirmNewPassword')?.value;
  return newpassword === confirm ? null : { passwordsMismatch: true };
}

@Component({
  selector: 'app-profile-security',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile-security.component.html',
  styleUrls: ['./profile-security.component.scss']
})
export class ProfileSecurityComponent {
  form: FormGroup;
  submitting = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;

  constructor(private auth: AuthService, private fb: FormBuilder) {
    this.form = this.fb.group(
      {
        oldpassword: ['', [Validators.required]],
        newpassword: ['', [Validators.required]],
        confirmNewPassword: ['', [Validators.required]],
      },
      { validators: passwordsMatchValidator }
    );
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const user = this.auth.currentUser;
    if (!user) return;

    this.submitting = true;
    this.successMessage = null;
    this.errorMessage = null;

    const { oldpassword, newpassword } = this.form.getRawValue();

    this.auth.changePassword({ email: user.email, oldpassword: oldpassword!, newpassword: newpassword! }).subscribe({
      next: () => {
        this.submitting = false;
        this.successMessage = 'Contraseña actualizada correctamente.';
        this.form.reset();
      },
      error: (msg) => {
        this.submitting = false;
        this.errorMessage = typeof msg === 'string' ? msg : 'No se pudo cambiar la contraseña.';
      },
    });
  }
}
