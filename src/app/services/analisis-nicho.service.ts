// analisis-nicho.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, forkJoin, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import type { FeatureCollection } from 'geojson';
import { environment } from '../../environments/environment';

/** -----------------------------
 *  Tipos de entrada (tus originales)
 *  ----------------------------- */
type CombinedConfig = {
  base: {
    region?: { regionId: number; resolution: string; gridId: number };
    taxonomy?: { level: string; values: string[] }[];
  };
  analysis: {
    region?: { regionId: number; resolution: string; gridId: number };
    taxonomy?: { level: string; values: string[] }[];
  };
};

// Alias tipado
type GeoJSONFC = FeatureCollection;

/** -----------------------------
 *  Tipos de salida "ergonómicos" para el front
 *  ----------------------------- */
export interface NichoResult {
  /** Capa para el mapa (GeoJSON de celdas / resultados) */
  grid: GeoJSONFC;
  /** Resumen/estadísticas (si no hay endpoint, dejar como {}) */
  stats: any;
  /** Filas para tabla (si no hay endpoint, derivar o dejar []) */
  tableRows: any[];
  /** UUID obtenido de getEpsScrRelation (para histogramas) */
  uuid?: string | null;
}

/** (Opcional) parámetros simplificados si algún día quisieras otra ruta */
export interface NichoParams {
  regionId: number;
  resolution: string | number;
  gridId: number;
  taxonomy: { level: string; values: string[] }[];
}

/** -----------------------------
 *  Respuesta de getEpsScrRelation
 *  ----------------------------- */
interface EpsScrRelationResponse {
  uuid: string;
  // ...otros campos que tu API devuelva
}

/** -----------------------------
 *  Config
 *  ----------------------------- */
const BASE_URL = environment.apiBaseUrl + '/mdf';

console.log('ana ENV production:', environment.production);
console.log('ana API base:', environment.apiBaseUrl);


@Injectable({ providedIn: 'root' })
export class AnalisisNichoService {
  private http = inject(HttpClient);

  /** Guarda y expone el UUID del último análisis */
  private uuidSubject = new BehaviorSubject<string | null>(null);
  uuid$ = this.uuidSubject.asObservable();

  /** Acceso inmediato al último uuid (sincrónico) */
  get uuid(): string | null {
    return this.uuidSubject.value;
  }

  /**
   * Método ORIGINAL (lo conservamos tal cual, pero con BASE_URL)
   * Devuelve el GeoJSON directamente desde tu backend.
   */
  getOccMapaAnalisisNicho(payload: CombinedConfig): Observable<GeoJSONFC> {
    return this.http.post<GeoJSONFC>(`${BASE_URL}/getOccMapaAnalisisNicho`, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * NUEVO: Ejecuta el análisis combinando:
   *  - Grid (GeoJSON) desde getOccMapaAnalisisNicho
   *  - UUID desde getEpsScrRelation (necesario para histogramas)
   *
   * Retorna un objeto listo para Mapa + Tabla, e incluye el uuid.
   * Además, actualiza uuid$ para que otros componentes lo consuman.
   */
  runAnalysisFromCombinedConfig(payload: CombinedConfig): Observable<NichoResult> {
    const grid$ = this.getOccMapaAnalisisNicho(payload).pipe(
      catchError(() => of<GeoJSONFC>({ type: 'FeatureCollection', features: [] }))
    );

    const relation$ = this.http
      .post<EpsScrRelationResponse>(`${BASE_URL}/getEpsScrRelation`, payload, {
        headers: { 'Content-Type': 'application/json' }
      })
      .pipe(
        catchError(() => of<EpsScrRelationResponse>({ uuid: null as unknown as string })),
        tap(res => this.uuidSubject.next(res?.uuid ?? null))
      );

    return forkJoin({ grid: grid$, relation: relation$ }).pipe(
      map(({ grid, relation }) => {
        const tableRows =
          (grid.features || []).map((f: any, idx: number) => ({
            id: idx + 1,
            cell: f?.properties?.cell ?? f?.properties?.id ?? idx + 1,
            total_epsilon: f?.properties?.total_epsilon ?? null,
            total_score: f?.properties?.total_score ?? null
          })) ?? [];

        const stats = {
          features: grid.features?.length ?? 0,
          epsilon_min: minSafe(tableRows.map(r => r.total_epsilon)),
          epsilon_max: maxSafe(tableRows.map(r => r.total_epsilon)),
          score_min: minSafe(tableRows.map(r => r.total_score)),
          score_max: maxSafe(tableRows.map(r => r.total_score))
        };

        const result: NichoResult = {
          grid,
          stats,
          tableRows,
          uuid: relation?.uuid ?? null
        };
        return result;
      })
    );
  }
}

/** -----------------------------
 *  Utilidades internas
 *  ----------------------------- */
function minSafe(arr: any[]): number | null {
  const nums = (arr || []).filter(isFiniteNumber);
  return nums.length ? Math.min(...nums) : null;
}

function maxSafe(arr: any[]): number | null {
  const nums = (arr || []).filter(isFiniteNumber);
  return nums.length ? Math.max(...nums) : null;
}

function isFiniteNumber(x: any): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}
