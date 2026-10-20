import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { MapaMaplibreComponent } from 'mapa-maplibre';
import { TablaSpeciesComponent } from 'tabla-species';
import { HistogramChartComponent } from 'histogram-chart';

import { NicheAnalysisStateService } from '../state/nicho-analysis-state.service';
import { CellScoreDetail, SOURCE_LABELS, TargetFilters } from '../state/nicho-analysis.models';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-resultados-step',
  standalone: true,
  imports: [CommonModule, FormsModule, MapaMaplibreComponent, TablaSpeciesComponent, HistogramChartComponent],
  templateUrl: './resultados-step.component.html',
  styleUrls: ['./resultados-step.component.scss']
})
export class ResultadosStepComponent {
  @ViewChild('mapNiche') mapNiche?: MapaMaplibreComponent;

  histogramBuckets = 10;

  constructor(public state: NicheAnalysisStateService, private router: Router, private auth: AuthService) {}

  goBack(): void {
    this.router.navigate(['/nicho-ecologico/covariables']);
  }

  /** Todos los getters de resumen tienen fallback a preloadedPayload/preloadedMeta
   *  porque en un "Re-ejecutar" desde el Historial (Mi cuenta) nunca se pasó por
   *  Target/Covariables, así que taxonSel/taxonSel2Sources quedan vacíos. */

  get targetSourceLabel(): string {
    if (this.state.usingPreloadedTarget && this.state.preloadedMeta?.targetSourceLabel) return this.state.preloadedMeta.targetSourceLabel;
    if (this.state.targetTercero) return SOURCE_LABELS['terceros'];
    const id = this.state.targetSourceId;
    return id != null ? (SOURCE_LABELS[id] ?? `Fuente #${id}`) : '—';
  }

  get regionDisplay(): string {
    if (this.state.usingPreloadedTarget && this.state.preloadedMeta?.region) return this.state.preloadedMeta.region;
    if (this.state.regionName) return this.state.regionName;
    return this.state.regionId != null ? `Región #${this.state.regionId}` : '—';
  }

  get resolutionDisplay(): string {
    if (this.state.usingPreloadedTarget && this.state.preloadedMeta?.resolution) return this.state.preloadedMeta.resolution;
    return this.state.resolution ?? '—';
  }

  get targetTaxonSummary(): string {
    if (this.state.usingPreloadedTarget) {
      return this.state.preloadedPayload!.target?.[0]?.q || 'Sin selección';
    }
    if (this.state.targetTercero) return `Colección propia: ${this.state.targetTercero.nombre_datos}`;
    const levels = this.state.taxonSel?.levels ?? [];
    if (levels.length === 0) return 'Sin selección';
    return levels
      .map(l => `${l.level}: ${(l.values ?? []).join(', ')}`)
      .join(' · ');
  }

  get covariablesSummary(): { source: string; values: string }[] {
    if (this.state.usingPreloadedCovars) {
      if (this.state.preloadedMeta?.covars?.length) return this.state.preloadedMeta.covars;
      return (this.state.preloadedPayload!.covars ?? []).map(c => ({
        source: SOURCE_LABELS[c.id_source] ?? `Fuente #${c.id_source}`,
        values: c.q || 'Sin selección'
      }));
    }
    const taxonSummaries = this.state.taxonSel2Sources.map(src => {
      const label = SOURCE_LABELS[src.source_id] ?? `Fuente #${src.source_id}`;
      if (src.context?.idfuente != null || src.context?.layer) {
        const startLabel = this.state.covarStartLabel(src.source_id);
        if (startLabel) return { source: label, values: startLabel };
        const parts = [
          src.context?.idfuente != null ? `variable ${src.context.idfuente}` : null,
          src.context?.layer ? `capa ${src.context.layer}` : null
        ].filter(Boolean);
        return { source: label, values: parts.join(' · ') || 'Sin selección' };
      }
      const values = src.levels.map(l => `${l.level}: ${(l.values ?? []).join(', ')}`).join(' · ');
      return { source: label, values: values || 'Sin selección' };
    });
    const tercerosSummaries = this.state.covarTerceros.map(c => ({
      source: SOURCE_LABELS['terceros'],
      values: c.nombre_datos
    }));
    return [...taxonSummaries, ...tercerosSummaries];
  }

  get targetFiltersSummary(): string {
    if (this.state.targetTercero) return 'No aplica (colección propia)';
    const f = this.state.usingPreloadedTarget
      ? this.state.preloadedPayload!.target_filters
      : this.state.targetFilters;
    const base = describeTargetFilters(f);
    const n = this.state.excludedCells.length;
    return n ? `${base} · ${n} celda${n === 1 ? '' : 's'} borrada${n === 1 ? '' : 's'}` : base;
  }

  get analysisOptionsSummary(): string {
    const parts = [
      this.state.minNjEnabled ? `nj mínimo: ${this.state.minNj}` : 'Sin mínimo de nj',
      `A priori: ${this.state.apriori ? 'sí' : 'no'}`,
      `Mapa de probabilidad: ${this.state.mapaProb ? 'sí' : 'no'}`,
      this.state.validationEnabled ? `Validación: ${this.state.validationIterations} iteraciones` : 'Sin validación',
    ];
    return parts.join(' · ');
  }

  /** Panel con el detalle de la celda seleccionada en el mapa de Resultados. */
  cellPanel: { cellId: number; loading: boolean; error: string | null; detail: CellScoreDetail | null } | null = null;

  onResultCellClick(ev: { cell_id: number | string }): void {
    const uuid = this.state.uuidNiche;
    if (!uuid) return;
    const cellId = Number(ev.cell_id);
    this.cellPanel = { cellId, loading: true, error: null, detail: null };
    this.state.getCellScoreDetail(uuid, cellId).subscribe({
      next: (detail) => {
        if (this.cellPanel?.cellId !== cellId) return;
        this.cellPanel = { cellId, loading: false, error: null, detail };
      },
      error: (err) => {
        if (this.cellPanel?.cellId !== cellId) return;
        // El endpoint responde 404 con { error } cuando el análisis expiró en
        // Redis; un 404 sin ese cuerpo es que el servicio no tiene la ruta.
        const serverMsg = typeof err?.error?.error === 'string' ? err.error.error : null;
        const msg = serverMsg
          ?? (err?.status === 404
            ? 'El detalle por celda no está disponible en el servidor (falta actualizar el servicio).'
            : 'No se pudo obtener el detalle de la celda.');
        this.cellPanel = { cellId, loading: false, error: msg, detail: null };
      },
    });
  }

  closeCellPanel(): void {
    this.cellPanel = null;
  }

  /** Nombre legible de una covariable (mismo criterio que la tabla de resultados). */
  covarLabel(meta: any): string {
    const name = meta?.especie ?? meta?.species ?? meta?.label ?? meta?.layer ?? meta?.descripcion ?? meta?.nombre_datos;
    if (name) return String(name);
    const levels = ['genero', 'familia', 'orden', 'clase', 'phylum', 'reino'];
    const lvl = levels.find((l) => meta?.[l]);
    return lvl ? `${meta[lvl]} (${lvl})` : '—';
  }

  sourceLabel(id: number | string): string {
    return SOURCE_LABELS[id] ?? `Fuente #${id}`;
  }

  get canRunAnalysis(): boolean {
    return this.state.canRunAnalysis();
  }

  /** Botón "Ejecutar Análisis": arma el payload (misma lógica que antes tenía
   *  onVisualizeNicho() en el componente monolítico) y dispara el mapa de coocurrencias. */
  ejecutarAnalisis(): void {
    const payload = this.state.buildEpsScrPayload();
    if (!payload) return; // buildEpsScrPayload ya dejó validationMessages listos

    this.state.isAnalyzingNiche = true;

    if (this.mapNiche?.getEpsScrRelation) {
      (this.mapNiche as any).setLoading?.(true);
      // mapNiche reenvía este objeto tal cual como body del POST a
      // /mdf/getEpsScrRelation (ver mapa-maplibre.service getEpsScrRelationUnified) —
      // agregamos sessionid (para que middleware_datasources resuelva el usuario
      // autenticado) y meta (fuente/región/resolución legibles para el historial;
      // si venimos de un re-ejecutar, se reusa la meta original en vez de
      // reconstruirla, porque targetSourceId/regionName quedan vacíos en ese flujo).
      const baseMeta = (this.state.usingPreloadedTarget && this.state.preloadedMeta) || {
        targetSourceLabel: this.targetSourceLabel,
        region: this.regionDisplay,
        resolution: this.resolutionDisplay,
      };
      const meta = { ...baseMeta, covars: this.covariablesSummary };
      const payloadConSesion = { ...payload, sessionid: this.auth.sessionIdOrNull, meta };
      // as any: mapa-maplibre reenvía esto tal cual como JSON al backend, pero su propio
      // tipo RelationQuery no conoce id_source:'terceros' (colecciones propias), que
      // resuelve middleware_datasources — no afecta el runtime, solo el chequeo de tipos.
      this.mapNiche.getEpsScrRelation(payloadConSesion as any);
    } else {
      console.warn('getEpsScrRelation no existe en app-mapa-maplibre.');
      this.state.showValidationMessages(['No se encontró getEpsScrRelation en el mapa de Resultados.']);
      this.state.isAnalyzingNiche = false;
    }
  }

  onEpsScrRelReady(rows: any[]): void {
    this.cellPanel = null; // el panel era del análisis anterior
    console.log('[ResultadosStep] onEpsScrRelReady llamado con', rows?.length, 'filas');
    this.state.tableRows = Array.isArray(rows) ? rows : [];
    (this.mapNiche as any)?.setLoading?.(false);
    this.state.isAnalyzingNiche = false;
    console.log('[ResultadosStep] state.isAnalyzingNiche ahora es', this.state.isAnalyzingNiche);
  }

  onEpsScrExtrasReady(extras: { uuid: string | null; scoreDeciles: any[] }): void {
    console.log('[ResultadosStep] onEpsScrExtrasReady llamado con uuid', extras?.uuid);
    this.state.uuidNiche = extras?.uuid ?? null;
    this.state.selectedDecile = 10;
    this.state.scoreDeciles = Array.isArray(extras?.scoreDeciles) ? extras.scoreDeciles : [];
    this.state.decileHistogramData = this.state.scoreDeciles
      .slice()
      .sort((a, b) => b.decil - a.decil)
      .map(d => ({ label: d.decil.toString(), value: +d.avg_score_cell.toFixed(2) }));
    this.loadValidation();
  }

  /** La validación se calcula junto con el análisis y queda en Redis con el
   *  mismo uuid; se pide solo si el análisis la incluyó. */
  private loadValidation(): void {
    this.state.validationResult = null;
    this.state.validationError = null;
    const uuid = this.state.uuidNiche;
    const iterations = this.state.validationEnabled ? this.state.validationIterations : 0;
    if (!uuid || iterations < 2) return;
    this.state.validationLoading = true;
    this.state.getValidation(uuid).subscribe({
      next: (v) => {
        this.state.validationLoading = false;
        this.state.validationResult = v;
        if (v?.error) this.state.validationError = v.error;
      },
      error: (err) => {
        this.state.validationLoading = false;
        this.state.validationError = typeof err?.error?.error === 'string'
          ? err.error.error
          : 'No se pudo obtener la validación.';
      },
    });
  }

  /** Recall por decil (%) para la gráfica, del decil 10 al 1. */
  get recallChartData(): { label: string; value: number }[] {
    return (this.state.validationResult?.deciles ?? [])
      .filter((d) => d.recall !== null)
      .map((d) => ({ label: String(d.decil), value: +(d.recall! * 100).toFixed(1) }));
  }
}

/** Texto legible de los filtros del target (también lo usa el historial). */
export function describeTargetFilters(f: TargetFilters | undefined | null): string {
  if (!f) return 'Sin filtros';
  const ini = f.fecha_inicio, fin = f.fecha_fin;
  const fechas = ini !== null && fin !== null ? `Años ${ini}–${fin}`
    : ini !== null ? `Desde ${ini}`
    : fin !== null ? `Hasta ${fin}`
    : 'Cualquier año';
  return [fechas, `Sin fecha: ${f.sin_fecha ? 'sí' : 'no'}`, `Fósiles: ${f.fosil ? 'sí' : 'no'}`].join(' · ');
}
