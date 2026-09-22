import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthUser } from '../../../../core/auth/auth.models';

@Component({
  selector: 'app-profile-overview',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile-overview.component.html',
  styleUrls: ['./profile-overview.component.scss']
})
export class ProfileOverviewComponent implements OnInit {
  readonly user$;

  form: FormGroup;
  submitting = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;

  constructor(private auth: AuthService, private fb: FormBuilder) {
    this.user$ = this.auth.currentUser$;
    this.form = this.fb.group({
      name: ['', [Validators.required]],
      procedencia: [''],
    });
  }

  ngOnInit(): void {
    const user = this.auth.currentUser;
    if (user) {
      this.form.patchValue({ name: user.name, procedencia: user.procedencia ?? '' });
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.successMessage = null;
    this.errorMessage = null;

    const { name, procedencia } = this.form.getRawValue();

    this.auth.updateProfile({ name: name!, procedencia: procedencia! }).subscribe({
      next: (user: AuthUser) => {
        this.submitting = false;
        this.successMessage = 'Cambios guardados correctamente.';
        this.form.patchValue({ name: user.name, procedencia: user.procedencia ?? '' });
      },
      error: (msg) => {
        this.submitting = false;
        this.errorMessage = typeof msg === 'string' ? msg : 'No se pudo actualizar el perfil.';
      },
    });
  }
}
