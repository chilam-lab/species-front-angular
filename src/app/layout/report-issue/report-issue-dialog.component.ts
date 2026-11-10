import { Component, EventEmitter, HostListener, OnDestroy, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe } from 'taxon-shared';
import { AuthService } from '../../core/auth/auth.service';
import {
  ISSUE_ATTACHMENT_TYPES,
  ISSUE_MAX_ATTACHMENTS,
  ISSUE_MAX_ATTACHMENT_BYTES,
  IssueConfigMode,
  IssueReportService,
  IssueType,
} from '../../core/issues/issue-report.service';
import { IssueAnalysisContext, IssueContextService } from '../../core/issues/issue-context.service';

interface Evidence {
  file: File;
  url: string; // object URL para la miniatura
}

/** Ventana para reportar un problema o sugerencia; crea un issue en GitHub vía auth_backend. */
@Component({
  selector: 'app-report-issue-dialog',
  templateUrl: './report-issue-dialog.component.html',
  styleUrls: ['./report-issue-dialog.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe],
})
export class ReportIssueDialogComponent implements OnDestroy {
  @Output() closed = new EventEmitter<void>();

  readonly auth = inject(AuthService);
  private readonly issues = inject(IssueReportService);

  readonly tipos: IssueType[] = ['error', 'sugerencia'];
  tipo: IssueType = 'error';
  titulo = '';
  descripcion = '';

  readonly maxAttachments = ISSUE_MAX_ATTACHMENTS;
  readonly acceptTypes = ISSUE_ATTACHMENT_TYPES.join(',');
  evidence: Evidence[] = [];
  attachmentErrorKey: string | null = null;

  /** Configuración del análisis abierto al momento de abrir el diálogo (null fuera de Nicho). */
  readonly analysis: IssueAnalysisContext | null = inject(IssueContextService).snapshot();
  readonly configModes: IssueConfigMode[] = ['ninguna', 'resumen', 'completa'];
  configMode: IssueConfigMode = this.analysis ? 'resumen' : 'ninguna';
  showConfigPreview = false;

  sending = false;
  errorKey: string | null = null;
  issueNumber: number | null = null;

  get valid(): boolean {
    return this.titulo.trim().length >= 5 && this.descripcion.trim().length >= 10;
  }

  /** Lo que se enviará de la configuración, para la vista previa. */
  get configPreview(): string {
    if (!this.analysis || this.configMode === 'ninguna') return '';
    const { paso, resumen, payload } = this.analysis;
    return JSON.stringify(this.configMode === 'completa' ? { paso, resumen, payload } : { paso, resumen }, null, 2);
  }

  onFilesSelected(input: HTMLInputElement): void {
    this.addFiles(Array.from(input.files ?? []));
    input.value = ''; // permite volver a elegir el mismo archivo tras quitarlo
  }

  /** Ctrl+V con una captura en el portapapeles la agrega como evidencia. */
  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    const files = Array.from(event.clipboardData?.files ?? []).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;
    event.preventDefault();
    this.addFiles(files.map((f, i) => f.name && f.name !== 'image.png'
      ? f
      : new File([f], `captura-${Date.now()}-${i + 1}.png`, { type: f.type })));
  }

  private addFiles(files: File[]): void {
    this.attachmentErrorKey = null;
    for (const file of files) {
      if (this.evidence.length >= ISSUE_MAX_ATTACHMENTS) {
        this.attachmentErrorKey = 'rep.att.tooMany';
        break;
      }
      if (!ISSUE_ATTACHMENT_TYPES.includes(file.type)) {
        this.attachmentErrorKey = 'rep.att.badType';
        continue;
      }
      if (file.size > ISSUE_MAX_ATTACHMENT_BYTES) {
        this.attachmentErrorKey = 'rep.att.tooBig';
        continue;
      }
      this.evidence.push({ file, url: URL.createObjectURL(file) });
    }
  }

  removeEvidence(index: number): void {
    URL.revokeObjectURL(this.evidence[index].url);
    this.evidence.splice(index, 1);
    this.attachmentErrorKey = null;
  }

  private toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async send(): Promise<void> {
    if (this.sending) return;
    if (!this.valid) {
      this.errorKey = 'rep.invalid';
      return;
    }
    this.sending = true;
    this.errorKey = null;

    let adjuntos;
    try {
      adjuntos = await Promise.all(this.evidence.map(async e => ({
        nombre: e.file.name, tipo: e.file.type, base64: await this.toBase64(e.file),
      })));
    } catch {
      this.sending = false;
      this.attachmentErrorKey = 'rep.att.read';
      return;
    }

    const configuracion = this.analysis && this.configMode !== 'ninguna'
      ? {
          modo: this.configMode,
          paso: this.analysis.paso,
          resumen: this.analysis.resumen,
          ...(this.configMode === 'completa' ? { payload: this.analysis.payload } : {}),
        }
      : null;

    this.issues.report({
      tipo: this.tipo, titulo: this.titulo.trim(), descripcion: this.descripcion.trim(), adjuntos, configuracion,
    }).subscribe({
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
        } else if (status === 413) {
          this.errorKey = 'rep.att.tooBig';
        } else {
          this.errorKey = 'rep.error';
        }
      },
    });
  }

  close(): void {
    this.closed.emit();
  }

  ngOnDestroy(): void {
    this.evidence.forEach(e => URL.revokeObjectURL(e.url));
  }
}
