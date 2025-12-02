// src/app/services/occ.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';

export interface SplistItem {
  nivel: string;
  valor: string;
}

/** Forma normalizada que usa el mapa: ids y ocurrencias numéricas */
export interface OccRow {
  cell_id: number;
  occ: number;
}

/** Respuesta cruda posible desde el backend */
type OccRowRaw = {
  cell_id?: number | string;
  cell_is?: number | string;
  id?: number | string;
  cellId?: number | string;
  occ?: number | string;
};

@Injectable({ providedIn: 'root' })
export class OccService {
  /** Cambia esto por tu environment si lo prefieres */
  private readonly baseUrl = 'http://localhost:8087';

  constructor(private http: HttpClient) {}

  /**
   * Obtiene ocurrencias agregadas para el mapa.
   * SIEMPRE normaliza a { cell_id: number, occ: number } para evitar problemas de tipado/ids.
   */
  getOccOnMap(payload: { grid_id: number; array_splist: SplistItem[] }): Observable<{ data: OccRow[] }> {
    const url = `${this.baseUrl}/mdf/getOccOnMap`;

    return this.http.post<{ data?: OccRowRaw[] } | any>(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      // withCredentials: true, // <- descomenta si tu API usa cookies/sesión same-site
    }).pipe(
      map((res) => {
        const rawArr: OccRowRaw[] = Array.isArray(res?.data) ? res.data : [];

        const data: OccRow[] = rawArr
          .map((r) => {
            const rawId = r.cell_id ?? r.cell_is ?? r.id ?? r.cellId;
            const idNum = toNumberSafe(rawId);
            const occNum = toNumberSafe(r.occ);
            return (idNum != null && occNum != null)
              ? { cell_id: idNum, occ: occNum }
              : null;
          })
          .filter((x): x is OccRow => !!x);

        return { data };
      }),
      catchError((err) => {
        // Log útil en desarrollo
        // eslint-disable-next-line no-console
        console.error('[OccService] getOccOnMap error:', err);
        return throwError(() => err);
      })
    );
  }
}

/** Convierte a número si es posible; si no, regresa null */
function toNumberSafe(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
