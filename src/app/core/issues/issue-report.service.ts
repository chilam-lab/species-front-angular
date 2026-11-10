import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { I18nService } from 'taxon-shared';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

export type IssueType = 'error' | 'sugerencia';

/** Cuánta configuración del análisis se adjunta: nada, solo el resumen o resumen + JSON completo. */
export type IssueConfigMode = 'ninguna' | 'resumen' | 'completa';

/** Imagen de evidencia ya leída en el navegador (base64 sin el prefijo data:). */
export interface IssueAttachment {
  nombre: string;
  tipo: string;
  base64: string;
}

export interface IssueReportPayload {
  tipo: IssueType;
  titulo: string;
  descripcion: string;
  adjuntos?: IssueAttachment[];
  configuracion?: { modo: IssueConfigMode; paso: string; resumen: unknown; payload?: unknown } | null;
}

/** Límites de adjuntos (los mismos valida auth_backend). */
export const ISSUE_MAX_ATTACHMENTS = 3;
export const ISSUE_MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const ISSUE_ATTACHMENT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/**
 * Envía reportes de incidencias a auth_backend (/reportIssue), que crea el issue
 * en GitHub con el token del servidor. Requiere sesión: el backend valida el
 * sessionid y adjunta nombre y correo del usuario. Las imágenes y el JSON de la
 * configuración los sube el backend al repo de reportes y los enlaza en el issue.
 */
@Injectable({ providedIn: 'root' })
export class IssueReportService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);

  /** Regresa el número del issue creado. */
  report(payload: IssueReportPayload): Observable<number> {
    const body = {
      ...payload,
      sessionid: this.auth.sessionIdOrNull,
      contexto: {
        url: window.location.pathname + window.location.search,
        idioma: this.i18n.lang(),
        pantalla: `${window.innerWidth}x${window.innerHeight}`,
        navegador: navigator.userAgent,
      },
    };
    return this.http
      .post<{ status: number; issue?: { number: number } }>(`${environment.authBaseUrl}/reportIssue`, body)
      .pipe(map((res) => {
        if (res.status !== 0 || !res.issue) throw res;
        return res.issue.number;
      }));
  }
}
