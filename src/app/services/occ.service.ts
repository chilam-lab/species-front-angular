// src/app/services/occ.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import type { TargetFilters } from '../features/nicho-ecologico/state/nicho-analysis.models';


/** Resumen del mapa de Target: especies con registros, registros que pasan
 *  los filtros y celdas con presencia dentro de la región (ni). */
export interface OccSummary {
  species: number;
  occurrences: number;
  cells: number;
}

export interface CellOccRecord {
  nombre: string | null;
  anio: number | null;
  fecha: string | null;
  fuente: string | null;
  coleccion: string | null;
  /** Tipo de registro: procedenciaejemplar (SNIB) o basisOfRecord (GBIF). */
  tipo: string | null;
  url: string | null;
}

export interface CellOccResponse {
  cell_id: number;
  truncated: boolean;
  data: CellOccRecord[];
}

/** Registro del target con coordenadas y celda (descarga desde Resultados). */
export interface TargetOccRecord extends CellOccRecord {
  fosil: boolean | null;
  longitud: number;
  latitud: number;
  celda: number;
}

export interface TargetOccResponse {
  truncated: boolean;
  /** El target incluía colecciones propias, que no tienen registros individuales. */
  terceros_omitidos: boolean;
  data: TargetOccRecord[];
}

export interface SplistItem {
  nivel: string;
  valor: string;
}

/** Forma normalizada que usa el mapa: ids y ocurrencias numéricas */
export interface OccRow {
  cell_id: number;
  occ: number;
  /** false = celda fuera de la región del análisis (no cuenta en ni). */
  in_region?: boolean;
}

/** Respuesta cruda posible desde el backend */
type OccRowRaw = {
  cell_id?: number | string;
  cell_is?: number | string;
  id?: number | string;
  cellId?: number | string;
  occ?: number | string;
};

console.log('occ ENV production:', environment.production);
console.log('occ API base:', environment.apiBaseUrl);


@Injectable({ providedIn: 'root' })
export class OccService {
  /** Cambia esto por tu environment si lo prefieres */
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  /**
   * Obtiene ocurrencias agregadas para el mapa.
   * SIEMPRE normaliza a { cell_id: number, occ: number } para evitar problemas de tipado/ids.
   */
  getOccOnMap(payload: { grid_id: number; array_splist: SplistItem[]; source_id?: number; filters?: TargetFilters }): Observable<{ data: OccRow[]; summary: OccSummary | null }> {
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
            const inRegion = (r as any).in_region;
            return (idNum != null && occNum != null)
              ? { cell_id: idNum, occ: occNum, ...(typeof inRegion === 'boolean' ? { in_region: inRegion } : {}) }
              : null;
          })
          .filter((x): x is OccRow => !!x);

        const s = res?.summary;
        const summary: OccSummary | null = s
          ? { species: Number(s.species) || 0, occurrences: Number(s.occurrences) || 0, cells: Number(s.cells) || 0 }
          : null;

        return { data, summary };
      }),
      catchError((err) => {
        // Log útil en desarrollo
        // eslint-disable-next-line no-console
        console.error('[OccService] getOccOnMap error:', err);
        return throwError(() => err);
      })
    );
  }

  /** Todos los registros del target del análisis (en la región, sin celdas
   *  borradas), para descargarlos desde el mapa de Resultados. */
  getTargetOccurrences(payload: {
    grid_id: number; target: unknown[]; target_filters?: TargetFilters; excluded_cells?: number[];
  }): Observable<TargetOccResponse> {
    return this.http.post<TargetOccResponse>(`${this.baseUrl}/mdf/getTargetOccurrences`, payload, {
      headers: { 'Content-Type': 'application/json' },
    }).pipe(
      map((res) => ({
        truncated: !!res?.truncated,
        terceros_omitidos: !!res?.terceros_omitidos,
        data: Array.isArray(res?.data) ? res.data : [],
      }))
    );
  }

  /** Registros del target dentro de una celda (popup del mapa de Target). */
  getCellOccurrences(payload: {
    grid_id: number; cell_id: number; array_splist: SplistItem[]; source_id?: number; filters?: TargetFilters;
  }): Observable<CellOccResponse> {
    return this.http.post<CellOccResponse>(`${this.baseUrl}/mdf/getCellOccurrences`, payload, {
      headers: { 'Content-Type': 'application/json' },
    }).pipe(
      map((res) => ({
        cell_id: Number(res?.cell_id),
        truncated: !!res?.truncated,
        data: Array.isArray(res?.data) ? res.data : [],
      }))
    );
  }
}

/** Convierte a número si es posible; si no, regresa null */
function toNumberSafe(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
