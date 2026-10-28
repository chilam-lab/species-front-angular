import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe } from 'taxon-shared';
import { AuthService } from '../../core/auth/auth.service';
import { IssueReportService, IssueType } from '../../core/issues/issue-report.service';

/** Ventana para reportar un problema o sugerencia; crea un issue en GitHub vía auth_backend. */
@Component({
  selector: 'app-report-issue-dialog',
  templateUrl: './report-issue-dialog.component.html',
  styleUrls: ['./report-issue-dialog.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe],
})
export class ReportIssueDialogComponent {
  @Output() closed = new EventEmitter<void>();

  readonly auth = inject(AuthService);
  private readonly issues = inject(IssueReportService);

  readonly tipos: IssueType[] = ['error', 'sugerencia'];
  tipo: IssueType = 'error';
  titulo = '';
  descripcion = '';

  sending = false;
  errorKey: string | null = null;
  issueNumber: number | null = null;

  get valid(): boolean {
    return this.titulo.trim().length >= 5 && this.descripcion.trim().length >= 10;
  }

  send(): void {
    if (this.sending) return;
    if (!this.valid) {
      this.errorKey = 'rep.invalid';
      return;
    }
    this.sending = true;
    this.errorKey = null;
    this.issues.report({ tipo: this.tipo, titulo: this.titulo.trim(), descripcion: this.descripcion.trim() }).subscribe({
      next: (n) => {
        this.sending = false;
        this.issueNumber = n;
      },
      error: (err: unknown) => {
        this.sending = false;
        const status = err instanceof HttpErrorResponse ? err.status : 0;
        if (status === 403) {
          // Sesión expirada: limpia el estado local para que el diálogo pida iniciar sesión.
          this.auth.checkSession().subscribe();
          this.errorKey = 'rep.loginNeeded';
        } else if (status === 429) {
          this.errorKey = 'rep.tooMany';
        } else if (status === 400) {
          this.errorKey = 'rep.invalid';
        } else {
          this.errorKey = 'rep.error';
        }
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}
