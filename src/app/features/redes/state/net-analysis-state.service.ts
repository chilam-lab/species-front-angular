import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { I18nService } from 'taxon-shared';
import type { TaxonSelectorSnapshot } from 'taxon-selector';
import type { TaxonNavigatorSnapshot } from 'taxon-navigator';
import type { RedEdge } from 'red-species';
import { environment } from '../../../../environments/environment';
import { DEFAULT_TARGET_FILTERS, RelationQuery, SOURCE_LABELS, TargetFilters } from '../../nicho-ecologico/state/nicho-analysis.models';
import { sourcesToRelationQueries } from '../../nicho-ecologico/state/relation-query.utils';
import type { IssueAnalysisContext } from '../../../core/issues/issue-context.service';
import type { AnalysisHistoryMeta } from '../../../core/analysis-history/analysis-history.models';
import { AuthService } from '../../../core/auth/auth.service';
import type { TerceroRef } from '../../../core/nicho-rerun/pending-tercero-selection.service';
import { NetGroupSelection, NetPayload, NetResult } from './net-analysis.models';

export type NetGroup = 'fuente' | 'destino';

/** Fuentes de capas que se pueden combinar con SNIB o GBIF. */
const LAYER_SOURCE_IDS = [2, 4, 5];
/** Fuentes taxonómicas: las únicas con filtros de fecha y fósiles. */
const TAXONOMY_SOURCE_IDS = [1, 3];

/**
 * Estado del asistente de Redes de inferencia (Fuente → Destino → Resultados).
 * Se provee en la ruta /redes, igual que el de Nicho, para que se reinicie al
 * entrar al flujo y los guards lo vean.
 *
 * La fuente taxonómica (SNIB o GBIF) se elige una sola vez con el área: los dos
 * grupos solo pueden usar esa más las capas, así nunca se cruzan SNIB y GBIF
 * (uno es subconjunto del otro).
 */
@Injectable()
export class NetAnalysisStateService {
  static readonly SNIB_SOURCE_ID = 1;
  static readonly GBIF_SOURCE_ID = 3;

  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);

  // ===== Área =====
  taxonomySourceId: number = NetAnalysisStateService.SNIB_SOURCE_ID;
  regionId: number | null = null;
  regionName: string | null = null;
  resolution: string | null = null;
  gridId: number | null = null;

  // ===== Grupos =====
  readonly groups: Record<NetGroup, NetGroupSelection> = {
    fuente: { sources: [], filters: { ...DEFAULT_TARGET_FILTERS } },
    destino: { sources: [], filters: { ...DEFAULT_TARGET_FILTERS } },
  };
  /** Estado visual de selector/navegador por grupo, para restaurarlos al volver a un paso. */
  readonly selectorState: Record<NetGroup, TaxonSelectorSnapshot | null> = { fuente: null, destino: null };
  readonly navigatorState: Record<NetGroup, TaxonNavigatorSnapshot | null> = { fuente: null, destino: null };
  /** Consultas de una red cargada del historial ("Re-ejecutar"); valen mientras el
   *  usuario no vuelva a elegir variables en ese grupo (igual que en Nicho). */
  readonly preloaded: Record<NetGroup, RelationQuery[] | null> = { fuente: null, destino: null };
  /** Colecciones propias ("Mis datos") de cada grupo; se agregan desde Mi cuenta. */
  readonly terceros: Record<NetGroup, TerceroRef[]> = { fuente: [], destino: [] };

  // ===== Opciones =====
  /** Mínimo de celdas de los nodos destino (nj > minOcc), como la versión estable. */
  minOcc = 5;
  /** Umbral inicial de |ε| de las aristas que se dibujan. */
  minAbsEps = 2;
  /** Aristas que se dibujan de inicio (las de mayor |ε|). */
  readonly maxEdges = 5000;

  // ===== Resultado =====
  result: NetResult | null = null;
  /** Payload del último cálculo; si cambia la configuración, Resultados recalcula. */
  lastPayload: NetPayload | null = null;
  loading = false;
  error: string | null = null;

  validationMessages: string[] = [];

  /** Fuentes habilitadas en los selectores. Arreglo estable (no getter): un arreglo
   *  nuevo en cada detección de cambios hace que taxon-selector se reinicie sin fin. */
  enabledSourceIds: number[] = [NetAnalysisStateService.SNIB_SOURCE_ID, ...LAYER_SOURCE_IDS];

  sourceLabel(id: number | string | null | undefined): string {
    if (id === 'terceros') return this.i18n.t('ni.myData');
    return (id != null && SOURCE_LABELS[id]) || this.i18n.t('ni.source', { id: id ?? '?' });
  }

  /** Nombre legible de la región (region-selector solo emite el id). */
  resolveRegionName(regionId: number): void {
    this.regionName = null;
    this.http
      .post<{ regions: { id: number; name: string }[] }>(`${environment.apiBaseUrl}/mdf/getCatArea`, { source_id: this.taxonomySourceId })
      .subscribe({
        next: (res) => { this.regionName = (res?.regions ?? []).find(r => r.id === regionId)?.name ?? null; },
        error: () => { this.regionName = null; },
      });
  }

  /** Cambia la fuente taxonómica: lo elegido de la otra (SNIB ↔ GBIF) ya no vale en ningún grupo. */
  setTaxonomySource(id: number): void {
    if (id === this.taxonomySourceId) return;
    this.taxonomySourceId = id;
    this.enabledSourceIds = [id, ...LAYER_SOURCE_IDS];
    for (const g of ['fuente', 'destino'] as NetGroup[]) {
      this.groups[g].sources = this.groups[g].sources.filter(s => LAYER_SOURCE_IDS.includes(s.source_id));
      const pre = this.preloaded[g];
      if (pre) this.preloaded[g] = pre.filter(q => LAYER_SOURCE_IDS.includes(Number(q.id_source)));
      this.selectorState[g] = null;
      this.navigatorState[g] = null;
    }
    this.invalidate();
  }

  setGroupSources(group: NetGroup, sources: NetGroupSelection['sources']): void {
    this.groups[group].sources = sources.filter(s => this.enabledSourceIds.includes(s.source_id));
    this.preloaded[group] = null; // elegir aquí reemplaza lo cargado del historial
    this.invalidate();
  }

  /** La configuración cambió: el resultado mostrado ya no le corresponde. */
  invalidate(): void {
    this.validationMessages = [];
  }

  queries(group: NetGroup): RelationQuery[] {
    const fromSelector = this.preloaded[group] ?? sourcesToRelationQueries(this.groups[group].sources);
    return [...fromSelector, ...this.terceros[group].map(t => this.terceroQuery(t))];
  }

  /** Colección propia como consulta: middleware_datasources la resuelve con la sesión. */
  private terceroQuery(t: TerceroRef): RelationQuery {
    return { id_source: 'terceros', id_data: t.id_data, q: `${this.i18n.t('ni.myData')}: ${t.nombre_datos}`, offset: 0, limit: 0 };
  }

  setTerceros(group: NetGroup, list: TerceroRef[]): void {
    const seen = new Set<number>();
    this.terceros[group] = list.filter(t => !seen.has(t.id_data) && !!seen.add(t.id_data));
    this.invalidate();
  }

  removeTercero(group: NetGroup, id_data: number): void {
    this.setTerceros(group, this.terceros[group].filter(t => t.id_data !== id_data));
  }

  isPreloaded(group: NetGroup): boolean {
    return this.preloaded[group] !== null;
  }

  hasTaxonomy(group: NetGroup): boolean {
    return this.queries(group).some(q => TAXONOMY_SOURCE_IDS.includes(Number(q.id_source)));
  }

  /** Carga una red del historial: área, grupos, filtros y opciones. */
  loadPreloaded(payload: NetPayload, meta: AnalysisHistoryMeta | null): void {
    const taxo = [...payload.source, ...payload.target].map(q => Number(q.id_source)).find(id => TAXONOMY_SOURCE_IDS.includes(id));
    this.taxonomySourceId = meta?.taxonomySourceId ?? taxo ?? NetAnalysisStateService.SNIB_SOURCE_ID;
    this.enabledSourceIds = [this.taxonomySourceId, ...LAYER_SOURCE_IDS];
    this.gridId = payload.grid_id;
    this.regionId = meta?.regionId ?? null;
    this.regionName = meta?.region ?? null;
    this.resolution = meta?.resolution ?? null;
    // Las colecciones propias se separan para poder quitarlas igual que al agregarlas.
    const split = (qs: RelationQuery[]) => ({
      catalog: qs.filter(q => q.id_source !== 'terceros'),
      terceros: qs.filter(q => q.id_source === 'terceros' && q.id_data != null)
        .map(q => ({ id_data: q.id_data!, nombre_datos: q.q.replace(/^[^:]*:\s*/, '') })),
    });
    const f = split(payload.source);
    const d = split(payload.target);
    this.preloaded.fuente = f.catalog.length ? f.catalog : null;
    this.preloaded.destino = d.catalog.length ? d.catalog : null;
    this.terceros.fuente = f.terceros;
    this.terceros.destino = d.terceros;
    this.groups.fuente = { sources: [], filters: { ...DEFAULT_TARGET_FILTERS, ...(payload.source_filters ?? {}) } };
    this.groups.destino = { sources: [], filters: { ...DEFAULT_TARGET_FILTERS, ...(payload.target_filters ?? {}) } };
    this.selectorState.fuente = this.selectorState.destino = null;
    this.navigatorState.fuente = this.navigatorState.destino = null;
    this.minOcc = payload.min_occ ?? 5;
    this.minAbsEps = payload.min_abs_eps ?? 2;
    this.result = null;
    this.lastPayload = null;
  }

  /** Filtros solo si el grupo tiene SNIB/GBIF (las capas no tienen fecha ni fósiles). */
  private filtersFor(group: NetGroup): TargetFilters | undefined {
    return this.hasTaxonomy(group) ? { ...this.groups[group].filters } : undefined;
  }

  canGoToDestino(): boolean {
    return !!this.gridId && this.queries('fuente').length > 0;
  }

  canRun(): boolean {
    return this.canGoToDestino() && this.queries('destino').length > 0;
  }

  filtersErrors(group: NetGroup): string[] {
    const { fecha_inicio: ini, fecha_fin: fin } = this.groups[group].filters;
    const maxYear = new Date().getFullYear();
    const bad = (y: number | null) => y !== null && (!Number.isInteger(y) || y < 1 || y > maxYear);
    const errs: string[] = [];
    if (bad(ini) || bad(fin)) errs.push(this.i18n.t('ni.v.year', { max: maxYear }));
    if (ini !== null && fin !== null && ini > fin) errs.push(this.i18n.t('ni.v.yearOrder'));
    return errs;
  }

  /** input type=number vacío llega como null o '' según el navegador. */
  normalizeFilters(group: NetGroup): void {
    const f = this.groups[group].filters;
    for (const k of ['fecha_inicio', 'fecha_fin'] as const) {
      const v: any = f[k];
      f[k] = (v === '' || v === undefined || v === null) ? null : Number(v);
    }
    this.invalidate();
  }

  /** Payload del análisis; null y validationMessages llenos si falta algo. */
  buildPayload(): NetPayload | null {
    const errs: string[] = [];
    if (!this.gridId) errs.push(this.i18n.t('red.v.grid'));
    const source = this.queries('fuente');
    const target = this.queries('destino');
    if (source.length === 0) errs.push(this.i18n.t('red.v.fuente'));
    if (target.length === 0) errs.push(this.i18n.t('red.v.destino'));
    errs.push(...this.filtersErrors('fuente'), ...this.filtersErrors('destino'));
    this.validationMessages = errs;
    if (errs.length) return null;
    return {
      grid_id: this.gridId!,
      min_occ: Math.max(0, Math.floor(Number(this.minOcc) || 0)),
      source,
      target,
      source_filters: this.filtersFor('fuente'),
      target_filters: this.filtersFor('destino'),
      min_abs_eps: Math.max(0, Number(this.minAbsEps) || 0),
      limit: this.maxEdges,
    };
  }

  /** Calcula la red; con sesión, el backend la guarda en el historial con este resumen legible. */
  run(payload: NetPayload): Observable<NetResult> {
    const lines = (g: NetGroup) => this.queries(g).map(q => ({ source: this.sourceLabel(q.id_source), values: q.q }));
    const meta: AnalysisHistoryMeta = {
      tipo: 'redes',
      taxonomySourceId: this.taxonomySourceId,
      regionId: this.regionId,
      targetSourceLabel: this.sourceLabel(this.taxonomySourceId),
      region: this.regionName ?? undefined,
      resolution: this.resolution ?? undefined,
      fuente: lines('fuente'),
      destino: lines('destino'),
    };
    return this.http.post<NetResult>(`${environment.apiBaseUrl}/mdf/getNetRelation`,
      { ...payload, sessionid: this.auth.sessionIdOrNull, meta });
  }

  /** Aristas con otro umbral, sin recalcular la red. Con range (una barra del
   *  histograma) solo las de range.desde ≤ ε < range.hasta; umbral y signo se ignoran. */
  edges(minAbsEps: number, signo: 'ambos' | 'positivo' | 'negativo' = 'ambos',
        range: { desde: number; hasta: number } | null = null): Observable<{ total_edges: number; edges: RedEdge[] }> {
    return this.http.post<{ total_edges: number; edges: RedEdge[] }>(`${environment.apiBaseUrl}/mdf/getNetEdges`, {
      uuid: this.result?.uuid, min_abs_eps: minAbsEps, signo, limit: this.maxEdges,
      ...(range ? { eps_desde: range.desde, eps_hasta: range.hasta } : {}),
    });
  }

  /** Celdas de uno o dos nodos; con dos, también las que comparten (la arista). */
  cells(nodeIds: string[]): Observable<{ cells: Record<string, number[]>; interseccion: number[] | null }> {
    return this.http.post<{ cells: Record<string, number[]>; interseccion: number[] | null }>(
      `${environment.apiBaseUrl}/mdf/getNetCells`, { uuid: this.result?.uuid, nodes: nodeIds });
  }

  csvUrl(minAbsEps: number): string | null {
    return this.result ? `${environment.apiBaseUrl}/mdf/getNetCsv?uuid=${this.result.uuid}&min_abs_eps=${minAbsEps}` : null;
  }

  /** Configuración para "Reportar un problema". */
  issueSnapshot(paso: string): IssueAnalysisContext {
    const resumenGrupo = (g: NetGroup) => this.queries(g).map(q => `${this.sourceLabel(q.id_source)}: ${q.q}`).join(' | ') || null;
    return {
      paso,
      resumen: {
        analisis: 'redes de inferencia',
        fuente_taxonomica: this.sourceLabel(this.taxonomySourceId),
        region: this.regionName ?? this.regionId,
        resolucion: this.resolution,
        grid_id: this.gridId,
        nodos_fuente: resumenGrupo('fuente'),
        nodos_destino: resumenGrupo('destino'),
        min_celdas_destino: this.minOcc,
        umbral_eps: this.minAbsEps,
        uuid_analisis: this.result?.uuid ?? null,
        aristas: this.result?.total_edges ?? null,
      },
      payload: { configuracion_actual: this.buildPayloadSilently(), ultimo_ejecutado: this.lastPayload },
    };
  }

  /** Lo que haya configurado, aunque falte algo (sin validar ni tocar validationMessages). */
  private buildPayloadSilently(): Partial<NetPayload> {
    return {
      grid_id: this.gridId ?? undefined,
      min_occ: this.minOcc,
      source: this.queries('fuente'),
      target: this.queries('destino'),
      source_filters: this.filtersFor('fuente'),
      target_filters: this.filtersFor('destino'),
      min_abs_eps: this.minAbsEps,
      limit: this.maxEdges,
    };
  }
}
