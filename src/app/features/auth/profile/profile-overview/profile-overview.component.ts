import { Component, OnInit, inject } from '@angular/core';
import { I18nService, Lang, TranslatePipe } from 'taxon-shared';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthUser } from '../../../../core/auth/auth.models';

@Component({
  selector: 'app-profile-overview',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './profile-overview.component.html',
  styleUrls: ['./profile-overview.component.scss']
})
export class ProfileOverviewComponent implements OnInit {
  readonly i18n = inject(I18nService);
  readonly langs: Lang[] = ['es', 'en', 'pt'];
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
      idioma: [this.i18n.lang()],
    });
  }

  ngOnInit(): void {
    const user = this.auth.currentUser;
    if (user) {
      this.form.patchValue({ name: user.name, procedencia: user.procedencia ?? '', idioma: user.idioma ?? this.i18n.lang() });
    }
  }

  /** Fecha en el formato del idioma vigente. */
  formatDate(value: string | Date): string {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString(this.i18n.locale(), { year: 'numeric', month: 'long', day: 'numeric' });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.successMessage = null;
    this.errorMessage = null;

    const { name, procedencia, idioma } = this.form.getRawValue();

    this.auth.updateProfile({ name: name!, procedencia: procedencia!, idioma: idioma as Lang }).subscribe({
      next: (user: AuthUser) => {
        this.submitting = false;
        // El idioma elegido se aplica de inmediato (y queda guardado en la cuenta).
        this.i18n.setLang((user.idioma ?? idioma) as Lang);
        this.successMessage = this.i18n.t('prof.saved');
        this.form.patchValue({ name: user.name, procedencia: user.procedencia ?? '', idioma: user.idioma ?? idioma });
      },
      error: (msg) => {
        this.submitting = false;
        this.errorMessage = typeof msg === 'string' ? msg : this.i18n.t('prof.saveError');
      },
    });
  }
}
