import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  CovariableSource,
  MapQuery,
  OccRow,
  RelationQuery,
  SplistItem,
  TaxonSelectionPayload
} from './nicho-analysis.models';
import { environment } from '../../../../environments/environment';

/**
 * Estado compartido del asistente de 3 pasos (Target / Covariables / Resultados).
 * Se provee a nivel de NichoShellComponent (no en 'root') para que se resetee
 * limpiamente cada vez que el usuario entra al flujo de Nicho Ecológico.
 *
 * Contiene también los métodos puros que antes vivían como privados en
 * AppComponent (buildSplistFrom/collectValidation/buildQFromSplist) porque
 * los usan tanto el paso Target como el paso Resultados.
 */
@Injectable()
export class NicheAnalysisStateService {
  static readonly WORLDCLIM_SOURCE_ID = 2;
  static readonly DEM_SOURCE_ID = 4;

  constructor(private http: HttpClient) {}

  // ===== Target =====
  targetSourceId: number | null = null;
  covarsEnabledSourceIds: number[] | null = [1, 2, 4];
  regionId: number | null = null;
  /** Nombre legible de la región (ej. "Mexico") — se resuelve aparte porque
   *  region-selector solo emite el id numérico, no el nombre. */
  regionName: string | null = null;
  resolution: string | null = null;
  gridId: number | null = null;
  taxonSel: TaxonSelectionPayload = { levels: [] };

  mapQuery?: MapQuery;
  runStamp = 0;
  occValues: OccRow[] = [];
  isAnalyzingOcc = false;

  /** Se pone en true cuando onVisualize() (Target) termina con éxito.
   *  Gatilla el guard de avance a Covariables/Resultados. */
  targetMapGenerated = false;

  // ===== Covariables =====
  taxonSel2Sources: CovariableSource[] = [];
  isAnalyzingNiche = false;

  // ===== Resultados =====
  tableRows: any[] = [];
  scoreDeciles: { decil: number; avg_score_cell: number; cell_count: number }[] = [];
  decileHistogramData: { label: string; value: number }[] = [];
  uuidNiche: string | null = null;
  selectedDecile = 10;

  // ===== Validación (compartida) =====
  showValidation = false;
  validationMessages: string[] = [];

  /** Resuelve el nombre de la región elegida usando el mismo endpoint que ya
   *  usa region-selector internamente (getCatArea) — sin depender de esa
   *  librería, que solo emite el id numérico. */
  resolveRegionName(sourceId: number | null, regionId: number): void {
    this.regionName = null;
    const body: any = sourceId != null ? { source_id: sourceId } : {};
    this.http
      .post<{ regions: { id: number; name: string }[] }>(`${environment.apiBaseUrl}/mdf/getCatArea`, body)
      .subscribe({
        next: (res) => {
          const match = (res?.regions ?? []).find(r => r.id === regionId);
          this.regionName = match?.name ?? null;
        },
        error: () => { this.regionName = null; }
      });
  }

  showValidationMessages(msgs: string[]): void {
    this.validationMessages = msgs;
    this.showValidation = msgs.length > 0;
  }

  clearValidation(): void {
    this.showValidation = false;
    this.validationMessages = [];
  }

  isTaxonSelectionPayload(obj: any): obj is TaxonSelectionPayload {
    return !!obj && Array.isArray(obj.levels);
  }

  buildSplistFrom(payload: TaxonSelectionPayload): SplistItem[] {
    const out: SplistItem[] = [];
    const levels = Array.isArray(payload?.levels) ? payload.levels : [];
    for (const lvl of levels) {
      const nivelRaw = (lvl?.level ?? '').toString().trim();
      const nivel = nivelRaw ? nivelRaw.toLowerCase() : '';
      if (!nivel) continue;

      const rawList =
        (Array.isArray((lvl as any).values) && (lvl as any).values) ||
        (Array.isArray((lvl as any).selected) && (lvl as any).selected) ||
        (Array.isArray((lvl as any).items) && (lvl as any).items) ||
        (typeof (lvl as any).value !== 'undefined' ? [(lvl as any).value] : []);

      for (const it of rawList) {
        let valor = '';
        if (typeof it === 'string' || typeof it === 'number') {
          valor = String(it).trim();
        } else if (it && typeof it === 'object') {
          valor = String((it as any).value ?? (it as any).name ?? (it as any).label ?? '').trim();
        }
        if (valor) out.push({ nivel, valor });
      }
    }
    return out;
  }

  collectValidation(gridId: number | null, splist: SplistItem[]): string[] {
    const msgs: string[] = [];
    if (!gridId || gridId <= 0) msgs.push('Selecciona una región y una resolución (gridId inválido).');
    if (splist.length === 0) msgs.push('Selecciona al menos un taxón en el navegador.');
    return msgs;
  }

  buildQFromSplist(items: SplistItem[]): string {
    const byNivel = new Map<string, string[]>();
    for (const it of items || []) {
      const nivel = String(it?.nivel ?? '').trim();
      const valor = String(it?.valor ?? '').trim();
      if (!nivel || !valor) continue;
      const arr = byNivel.get(nivel) ?? [];
      arr.push(valor);
      byNivel.set(nivel, arr);
    }
    const parts: string[] = [];
    byNivel.forEach((vals, nivel) => {
      const uniq = Array.from(new Set(vals));
      parts.push(`${nivel} = ${uniq.join(', ')}`);
    });
    return parts.join('; ');
  }

  buildRelationQuery(q: string, id_source: number): RelationQuery {
    return { id_source, q, offset: 0, limit: 100000 };
  }

  /** Arma target+covars a partir del estado actual, igual que hacía onVisualizeNicho().
   *  Devuelve null y deja validationMessages listos si falta algo. */
  buildEpsScrPayload(): { grid_id: number; min_occ: number; target: RelationQuery[]; covars: RelationQuery[] } | null {
    if (!this.gridId) {
      this.showValidationMessages(['Selecciona región y resolución en Target.']);
      return null;
    }

    const splistTarget = this.buildSplistFrom(this.taxonSel);
    const qTarget = this.buildQFromSplist(splistTarget);

    const covarsQueries: RelationQuery[] = this.taxonSel2Sources
      .map(src => {
        const parts: string[] = [];
        if (src.context?.idfuente != null) parts.push(`idfuente = ${src.context.idfuente}`);
        if (src.context?.layer) parts.push(`layer = ${src.context.layer}`);

        if (parts.length === 0) {
          const splist = this.buildSplistFrom({ levels: src.levels });
          if (splist.length === 0) return null;
          const qBase = this.buildQFromSplist(splist);
          if (!qBase) return null;
          parts.push(qBase);
        }

        return this.buildRelationQuery(parts.join('; '), src.source_id);
      })
      .filter((item): item is RelationQuery => item !== null);

    const errs: string[] = [];
    if (splistTarget.length === 0) errs.push('Selecciona al menos un taxón en Target.');
    if (covarsQueries.length === 0) errs.push('Selecciona al menos un taxón en Covariables.');
    if (errs.length) {
      this.showValidationMessages(errs);
      return null;
    }

    this.clearValidation();
    return {
      grid_id: this.gridId,
      min_occ: 5,
      target: [this.buildRelationQuery(qTarget, this.taxonSel.source_id ?? 1)],
      covars: covarsQueries
    };
  }

  /** true si target+covariables ya tienen lo mínimo para poder ejecutar el análisis
   *  (usado por Resultados para habilitar/deshabilitar el botón sin mutar validationMessages). */
  canRunAnalysis(): boolean {
    if (!this.gridId) return false;
    const splistTarget = this.buildSplistFrom(this.taxonSel);
    if (splistTarget.length === 0) return false;
    return this.taxonSel2Sources.length > 0;
  }
}
