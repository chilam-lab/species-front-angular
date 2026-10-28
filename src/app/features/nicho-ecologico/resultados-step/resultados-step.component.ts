import { Component, ViewChild, effect, inject, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { MapaMaplibreComponent, fileStamp, saveFile } from 'mapa-maplibre';
import { TablaSpeciesComponent } from 'tabla-species';
import { HistogramChartComponent } from 'histogram-chart';
import { I18nService, TranslatePipe } from 'taxon-shared';

import { NicheAnalysisStateService } from '../state/nicho-analysis-state.service';
import { CellScoreDetail, EpsScrPayload, TargetFilters } from '../state/nicho-analysis.models';
import { OccService, TargetOccRecord } from '../../../services/occ.service';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-resultados-step',
  standalone: true,
  imports: [CommonModule, FormsModule, MapaMaplibreComponent, TablaSpeciesComponent, HistogramChartComponent, TranslatePipe],
  templateUrl: './resultados-step.component.html',
  styleUrls: ['./resultados-step.component.scss']
})
export class ResultadosStepComponent {
  @ViewChild('mapNiche') mapNiche?: MapaMaplibreComponent;

  histogramBuckets = 10;

  private readonly i18n = inject(I18nService);

  constructor(public state: NicheAnalysisStateService, private router: Router, private auth: AuthService,
              private occService: OccService) {
    // El detalle del tooltip de la línea de recall se arma como texto: se
    // rehace al cambiar de idioma.
    effect(() => {
      this.i18n.lang();
      untracked(() => this.updateRecallLine());
    });
  }

  goBack(): void {
    this.router.navigate(['/nicho-ecologico/covariables']);
  }

  /** Todos los getters de resumen tienen fallback a preloadedPayload/preloadedMeta
   *  porque en un "Re-ejecutar" desde el Historial (Mi cuenta) nunca se pasó por
   *  Target/Covariables, así que taxonSel/taxonSel2Sources quedan vacíos. */

  get targetSourceLabel(): string {
    if (this.state.usingPreloadedTarget && this.state.preloadedMeta?.targetSourceLabel) return this.state.preloadedMeta.targetSourceLabel;
    if (this.state.targetTercero) return this.state.sourceLabel('terceros');
    const id = this.state.targetSourceId;
    return id != null ? this.state.sourceLabel(id) : '—';
  }

  get regionDisplay(): string {
    if (this.state.usingPreloadedTarget && this.state.preloadedMeta?.region) return this.state.preloadedMeta.region;
    if (this.state.regionName) return this.state.regionName;
    return this.state.regionId != null ? this.i18n.t('ni.region', { id: this.state.regionId }) : '—';
  }

  get resolutionDisplay(): string {
    if (this.state.usingPreloadedTarget && this.state.preloadedMeta?.resolution) return this.state.preloadedMeta.resolution;
    return this.state.resolution ?? '—';
  }

  get targetTaxonSummary(): string {
    if (this.state.usingPreloadedTarget) {
      return this.state.preloadedPayload!.target?.[0]?.q || this.i18n.t('ni.none');
    }
    if (this.state.targetTercero) return this.i18n.t('ni.r.ownCollection', { name: this.state.targetTercero.nombre_datos });
    const levels = this.state.taxonSel?.levels ?? [];
    if (levels.length === 0) return this.i18n.t('ni.none');
    return levels
      .map(l => `${this.i18n.level(l.level)}: ${(l.values ?? []).join(', ')}`)
      .join(' · ');
  }

  get covariablesSummary(): { source: string; values: string }[] {
    if (this.state.usingPreloadedCovars) {
      if (this.state.preloadedMeta?.covars?.length) return this.state.preloadedMeta.covars;
      return (this.state.preloadedPayload!.covars ?? []).map(c => ({
        source: this.state.sourceLabel(c.id_source),
        values: c.q || this.i18n.t('ni.none')
      }));
    }
    const taxonSummaries = this.state.taxonSel2Sources.map(src => {
      const label = this.state.sourceLabel(src.source_id);
      if (src.context?.idfuente != null || src.context?.layer) {
        const startLabel = this.state.covarStartLabel(src.source_id);
        if (startLabel) return { source: label, values: startLabel };
        const parts = [
          src.context?.idfuente != null ? this.i18n.t('ni.r.variable', { v: src.context.idfuente }) : null,
          src.context?.layer ? this.i18n.t('ni.r.layer', { v: src.context.layer }) : null
        ].filter(Boolean);
        return { source: label, values: parts.join(' · ') || this.i18n.t('ni.none') };
      }
      const values = src.levels.map(l => `${this.i18n.level(l.level)}: ${(l.values ?? []).join(', ')}`).join(' · ');
      return { source: label, values: values || this.i18n.t('ni.none') };
    });
    const tercerosSummaries = this.state.covarTerceros.map(c => ({
      source: this.state.sourceLabel('terceros'),
      values: c.nombre_datos
    }));
    return [...taxonSummaries, ...tercerosSummaries];
  }

  get targetFiltersSummary(): string {
    if (this.state.targetTercero) return this.i18n.t('ni.r.notApplicable');
    const f = this.state.usingPreloadedTarget
      ? this.state.preloadedPayload!.target_filters
      : this.state.targetFilters;
    const base = describeTargetFilters(f, this.i18n);
    const n = this.state.excludedCells.length;
    return n ? `${base} · ${this.i18n.t('ni.r.cellsDeleted', { n })}` : base;
  }

  /** Partes de un resumen "a · b · c" para mostrarlas como etiquetas; las
   *  consultas guardadas ("especie = Lynx rufus") se muestran como "Especie: Lynx rufus". */
  chips(text: string | null | undefined): string[] {
    return String(text ?? '')
      .split(' · ')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => {
        const m = /^([\wáéíóúñ]+)\s*=\s*(.+)$/i.exec(x);
        return m ? `${this.i18n.level(m[1]).replace(/^./, (ch) => ch.toUpperCase())}: ${m[2]}` : x;
      });
  }

  get analysisOptionsSummary(): string {
    const t = (k: string, p?: Record<string, string | number>) => this.i18n.t(k, p);
    const yn = (b: boolean) => t(b ? 'ni.yes' : 'ni.no');
    const parts = [
      this.state.minNjEnabled ? t('ni.r.opt.minNj', { n: this.state.minNj }) : t('ni.r.opt.noMinNj'),
      t('ni.r.opt.apriori', { v: yn(this.state.apriori) }),
      t('ni.r.opt.prob', { v: yn(this.state.mapaProb) }),
      this.state.validationEnabled ? t('ni.r.opt.validation', { n: this.state.validationIterations }) : t('ni.r.opt.noValidation'),
    ];
    return parts.join(' · ');
  }

  /** El último análisis usó mapa de probabilidad (escala fija 0–100%; el
   *  selector de coloración no aplica). */
  lastRunProb = false;

  /* ===== Descargas del mapa de Resultados (como la versión estable) ===== */

  /** Payload del último análisis: los registros del target se piden con el
   *  mismo target, filtros y celdas borradas. */
  private lastRunPayload: EpsScrPayload | null = null;
  downloadBusy = false;
  downloadNotice: string | null = null;

  /** Opciones del menú de descarga además del mapa (GeoJSON de celdas, que
   *  resuelve el propio componente del mapa). */
  get extraDownloads(): Array<{ id: string; label: string }> {
    if (!this.lastRunPayload || !this.state.uuidNiche) return [];
    return [
      { id: 'occ-geojson', label: this.i18n.t('ni.r.dl.occGeojson') },
      { id: 'occ-csv', label: this.i18n.t('ni.r.dl.occCsv') },
    ];
  }

  onDownloadRequest(id: string): void {
    const p = this.lastRunPayload;
    if (!p || this.downloadBusy) return;
    this.downloadBusy = true;
    this.downloadNotice = null;
    this.occService.getTargetOccurrences({
      grid_id: p.grid_id, target: p.target, target_filters: p.target_filters, excluded_cells: p.excluded_cells,
    }).subscribe({
      next: (res) => {
        this.downloadBusy = false;
        const notes: string[] = [];
        if (res.terceros_omitidos) notes.push(this.i18n.t('ni.r.dl.terceros'));
        if (res.truncated) notes.push(this.i18n.t('ni.r.dl.truncated', { n: res.data.length }));
        if (!res.data.length) {
          this.downloadNotice = [this.i18n.t('ni.r.dl.empty'), ...notes].join(' ');
          return;
        }
        this.downloadNotice = notes.length ? notes.join(' ') : null;
        if (id === 'occ-csv') {
          saveFile('\ufeff' + this.occCsv(res.data), `nicho_registros_${fileStamp()}.csv`, 'text/csv;charset=utf-8');
        } else {
          saveFile(JSON.stringify(this.occGeojson(res.data)), `nicho_registros_${fileStamp()}.geojson`, 'application/geo+json');
        }
      },
      error: () => {
        this.downloadBusy = false;
        this.downloadNotice = this.i18n.t('ni.r.dl.error');
      },
    });
  }

  private static readonly OCC_FIELDS = ['nombre', 'anio', 'fecha', 'fuente', 'coleccion', 'tipo', 'fosil', 'celda', 'longitud', 'latitud', 'url'] as const;

  /** Puntos con los atributos del registro (CRS84, como la versión estable). */
  private occGeojson(rows: TargetOccRecord[]): unknown {
    return {
      type: 'FeatureCollection',
      crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
      features: rows.map((r) => {
        const properties: Record<string, unknown> = {};
        for (const k of ResultadosStepComponent.OCC_FIELDS) if (k !== 'longitud' && k !== 'latitud') properties[k] = r[k] ?? null;
        return { type: 'Feature', geometry: { type: 'Point', coordinates: [r.longitud, r.latitud] }, properties };
      }),
    };
  }

  private occCsv(rows: TargetOccRecord[]): string {
    const cell = (v: unknown) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const fields = ResultadosStepComponent.OCC_FIELDS;
    return [fields.join(','), ...rows.map((r) => fields.map((k) => cell(r[k])).join(','))].join('\r\n');
  }

  readonly colorModes = [
    { value: 'deviation', labelKey: 'ni.r.mode.deviation' },
    { value: 'range', labelKey: 'ni.r.mode.range' },
    { value: 'jenks', labelKey: 'ni.r.mode.jenks' },
  ] as const;

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
            ? this.i18n.t('ni.r.cellNoRoute')
            : this.i18n.t('ni.r.cellError'));
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
    return this.state.sourceLabel(id);
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
      this.lastRunProb = payload.mapa_prob === true;
      this.lastRunPayload = payload;
      this.downloadNotice = null;
      // as any: mapa-maplibre reenvía esto tal cual como JSON al backend, pero su propio
      // tipo RelationQuery no conoce id_source:'terceros' (colecciones propias), que
      // resuelve middleware_datasources — no afecta el runtime, solo el chequeo de tipos.
      this.mapNiche.getEpsScrRelation(payloadConSesion as any);
    } else {
      console.warn('getEpsScrRelation no existe en app-mapa-maplibre.');
      this.state.showValidationMessages([this.i18n.t('ni.r.noMap')]);
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

  /** El recall se calcula junto con el análisis y queda en Redis con el mismo
   *  uuid: con validación es el promedio de las k iteraciones; sin ella, el del
   *  modelo completo (como la versión estable, que siempre dibuja la línea). */
  private loadValidation(): void {
    this.state.validationResult = null;
    this.state.validationError = null;
    this.recallLine = null;
    this.recallTooltip = null;
    const uuid = this.state.uuidNiche;
    if (!uuid) return;
    this.state.validationLoading = true;
    this.state.getValidation(uuid).subscribe({
      next: (v) => {
        this.state.validationLoading = false;
        this.state.validationResult = v;
        if (v?.error) this.state.validationError = v.error;
        this.updateRecallLine();
      },
      error: (err) => {
        this.state.validationLoading = false;
        this.state.validationError = typeof err?.error?.error === 'string'
          ? err.error.error
          : this.i18n.t('ni.r.validationError');
      },
    });
  }

  /** Recall (%) alineado con las barras del histograma de deciles (mismo orden
   *  de etiquetas); null sin validación. Se guarda como arreglo fijo y no como
   *  getter: un arreglo nuevo en cada ciclo de detección de cambios haría que
   *  la gráfica se redibujara sin parar. */
  recallLine: Array<number | null> | null = null;
  /** Detalle del tooltip de cada punto de la línea (VP, FN, nulos), como la
   *  versión estable; mismo orden que recallLine. */
  recallTooltip: Array<string[] | null> | null = null;

  private updateRecallLine(): void {
    const v = this.state.validationResult;
    const dec = v?.deciles;
    if (!dec?.length) { this.recallLine = null; this.recallTooltip = null; return; }
    const byDecil = new Map(dec.map((d) => [String(d.decil), d]));
    this.recallLine = this.state.decileHistogramData.map((b) => {
      const r = byDecil.get(b.label)?.recall;
      return r === null || r === undefined ? null : +(r * 100).toFixed(1);
    });
    this.recallTooltip = this.state.decileHistogramData.map((b) => {
      const d = byDecil.get(b.label);
      if (!d) return null;
      const t = (k: string, p: Record<string, string | number>) => this.i18n.t(k, p);
      const lines = [t('ni.r.tt.vp', { n: d.vp }), t('ni.r.tt.fn', { n: d.fn }), t('ni.r.tt.null', { n: d.nulo })];
      if (!v!.full_model && d.recall_min !== null && d.recall_max !== null) {
        lines.push(t('ni.r.tt.range', { a: (d.recall_min * 100).toFixed(1), b: (d.recall_max * 100).toFixed(1) }));
      }
      return lines;
    });
  }
}

/** Texto legible de los filtros del target (también lo usa el historial). */
export function describeTargetFilters(f: TargetFilters | undefined | null, i18n: I18nService): string {
  if (!f) return i18n.t('ni.f.none');
  const ini = f.fecha_inicio, fin = f.fecha_fin;
  const yn = (b: boolean) => i18n.t(b ? 'ni.yes' : 'ni.no');
  const fechas = ini !== null && fin !== null ? i18n.t('ni.f.years', { a: ini, b: fin })
    : ini !== null ? i18n.t('ni.f.from', { a: ini })
    : fin !== null ? i18n.t('ni.f.to', { b: fin })
    : i18n.t('ni.f.any');
  return [fechas, i18n.t('ni.f.noDate', { v: yn(f.sin_fecha) }), i18n.t('ni.f.fossil', { v: yn(f.fosil) })].join(' · ');
}
