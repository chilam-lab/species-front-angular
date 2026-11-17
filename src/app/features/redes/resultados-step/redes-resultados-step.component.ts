import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RedColorMode, RedEdge, RedNode, RedSpeciesComponent } from 'red-species';
import { MapaMaplibreComponent } from 'mapa-maplibre';
import { HistogramChartComponent } from 'histogram-chart';
import { I18nService, TranslatePipe } from 'taxon-shared';
import { SOURCE_LABELS } from '../../nicho-ecologico/state/nicho-analysis.models';
import { NetAnalysisStateService } from '../state/net-analysis-state.service';
import { NetHistogramBin } from '../state/net-analysis.models';
import { describeTargetFilters } from '../../nicho-ecologico/resultados-step/resultados-step.component';

type Signo = 'ambos' | 'positivo' | 'negativo';
type SortKey = 'source' | 'target' | 'nij' | 'nj' | 'ni' | 'epsilon' | 'score';

/** Valor "occ" de la rampa del mapa (amarillo → rojo) para cada tipo de celda. */
const OCC_FUENTE = 1;
const OCC_DESTINO = 3;
const OCC_COMPARTIDA = 8;
/** Barras máximas del histograma; con más, se juntan de dos en dos. */
const MAX_HIST_BARS = 40;
const PAGE_SIZE = 25;

/**
 * Resultados de la red: se calcula al entrar (solo si la configuración cambió
 * desde el último cálculo) y se explora sin recalcular. Red, mapa, histograma y
 * tabla están enlazados: elegir un nodo o una arista en la red o en la tabla
 * muestra sus celdas en el mapa y filtra/resalta la tabla.
 */
@Component({
  selector: 'app-redes-resultados-step',
  standalone: true,
  imports: [CommonModule, FormsModule, RedSpeciesComponent, MapaMaplibreComponent, HistogramChartComponent, TranslatePipe],
  templateUrl: './redes-resultados-step.component.html',
  styleUrls: ['./redes-resultados-step.component.scss'],
})
export class RedesResultadosStepComponent implements OnInit {
  @ViewChild(RedSpeciesComponent) red?: RedSpeciesComponent;
  readonly state = inject(NetAnalysisStateService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  readonly sourceLabels: Record<string, string> = { ...SOURCE_LABELS } as Record<string, string>;
  readonly signos: Signo[] = ['ambos', 'positivo', 'negativo'];
  readonly occColors = { fuente: '#ffd54f', destino: '#ff9800', compartida: '#d32f2f' };

  edges: RedEdge[] = [];
  totalEdges = 0;
  minAbsEps = 2;
  signo: Signo = 'ambos';
  colorBy: RedColorMode = 'grupo';
  filtering = false;

  selectedNode: RedNode | null = null;
  selectedEdge: RedEdge | null = null;
  private nodeIndex = new Map<string, RedNode>();

  // ===== Mapa =====
  mapOcc: { cell_id: number; occ: number }[] = [];
  mapRun = 0;
  mapLoading = false;
  mapCounts: { fuente: number; destino: number; compartida: number } | null = null;

  // ===== Histograma =====
  histData: { label: string; value: number }[] = [];
  /** Pares con |ε| ≥ umbral según el histograma (todos los pares, no solo los dibujados). */
  histAboveThreshold = 0;
  private histBins: NetHistogramBin[] = [];

  // ===== Tabla =====
  search = '';
  sortKey: SortKey = 'epsilon';
  sortDesc = true;
  page = 0;
  readonly pageSize = PAGE_SIZE;

  /** Configuración que se va a calcular (null si falta algo: el guard lo evita). */
  private pendingPayload = this.state.buildPayload();

  ngOnInit(): void {
    // Como en Nicho, la red se calcula hasta dar clic en "Generar red". Si ya se
    // calculó con esta misma configuración (vigente 1 h en el servidor), se muestra.
    if (this.state.result && this.isCurrent()) this.showResult();
    else this.state.result = null;
  }

  /** El resultado mostrado corresponde a la configuración actual. */
  private isCurrent(): boolean {
    return JSON.stringify(this.pendingPayload) === JSON.stringify(this.state.lastPayload);
  }

  generar(): void {
    const payload = this.state.buildPayload();
    if (!payload || this.state.loading) return;
    this.pendingPayload = payload;
    this.state.loading = true;
    this.state.error = null;
    this.state.result = null;
    this.state.run(payload).subscribe({
      next: (r) => {
        this.state.result = r;
        this.state.lastPayload = payload;
        this.state.loading = false;
        this.showResult();
      },
      error: (e) => {
        this.state.loading = false;
        this.state.error = e?.error?.codigo === 'snib_gbif' ? this.i18n.t('red.r.snibGbif') : this.i18n.t('red.r.error');
      },
    });
  }

  // ===== Resumen (igual que el de Nicho) =====

  /** Una ficha por fuente de un grupo: "Género: Aedes", "Capa: bio001"… */
  groupChips(group: 'fuente' | 'destino'): { source: string; value: string }[] {
    return this.state.queries(group).flatMap(q =>
      q.q.split(';').map(part => part.trim()).filter(Boolean).map(part => ({
        source: this.state.sourceLabel(q.id_source),
        value: this.prettyCondition(part),
      })));
  }

  private prettyCondition(part: string): string {
    const m = /^([\wáéíóúñ]+)\s*=\s*(.+)$/i.exec(part);
    if (!m) return part;
    const [, level, value] = m;
    if (level.toLowerCase() === 'idfuente') return this.i18n.t('red.s.allLayers');
    if (level.toLowerCase() === 'layer') return this.i18n.t('red.s.layer', { v: value });
    return `${this.i18n.level(level).replace(/^./, ch => ch.toUpperCase())}: ${value}`;
  }

  get filtersChips(): string[] {
    const out: string[] = [];
    for (const g of ['fuente', 'destino'] as const) {
      if (!this.state.hasTaxonomy(g)) continue;
      out.push(this.i18n.t('red.s.filters.' + g, { v: describeTargetFilters(this.state.groups[g].filters, this.i18n) }));
    }
    return out.length ? out : [this.i18n.t('red.s.noFilters')];
  }

  get optionsChips(): string[] {
    return [
      this.i18n.t('red.s.minOcc', { n: this.state.minOcc }),
      this.i18n.t('red.s.eps', { n: this.state.minAbsEps }),
      this.i18n.t('red.s.maxEdges', { n: this.state.maxEdges.toLocaleString(this.i18n.locale()) }),
    ];
  }

  get canGenerate(): boolean {
    return this.state.canRun() && !this.state.loading;
  }

  private showResult(): void {
    const r = this.state.result!;
    this.nodeIndex = new Map(r.nodes.map(n => [n.id, n]));
    this.edges = r.edges;
    this.totalEdges = r.total_edges;
    this.minAbsEps = r.min_abs_eps;
    this.signo = 'ambos';
    this.histBins = this.compactBins(r.stats.histograma);
    this.updateHistogram();
    this.clearSelection();
  }

  /** Otro umbral o signo, sin recalcular la red. */
  applyFilter(): void {
    if (!this.state.result) return;
    this.filtering = true;
    this.state.edges(this.minAbsEps, this.signo).subscribe({
      next: (r) => {
        this.edges = r.edges;
        this.totalEdges = r.total_edges;
        this.filtering = false;
        this.page = 0;
        this.updateHistogram();
        if (this.selectedEdge && !this.edges.includes(this.selectedEdge)) this.clearSelection();
      },
      error: (e) => {
        this.filtering = false;
        this.state.error = e?.error?.codigo === 'expirado' ? this.i18n.t('red.r.expired') : this.i18n.t('red.r.error');
      },
    });
  }

  // ===== Histograma de ε (todos los pares) =====

  /** Junta barras vecinas de dos en dos hasta que queden ≤ MAX_HIST_BARS. */
  private compactBins(bins: NetHistogramBin[]): NetHistogramBin[] {
    let out = bins.slice();
    while (out.length > MAX_HIST_BARS) {
      const merged: NetHistogramBin[] = [];
      for (let i = 0; i < out.length; i += 2) {
        const a = out[i];
        const b = out[i + 1];
        merged.push(b ? { desde: a.desde, hasta: b.hasta, count: a.count + b.count } : a);
      }
      out = merged;
    }
    return out;
  }

  /** Etiqueta de cada barra; las que pasan el umbral se marcan con ●. */
  private updateHistogram(): void {
    const passes = (b: NetHistogramBin) => {
      const pos = this.signo !== 'negativo' && b.desde >= this.minAbsEps;
      const neg = this.signo !== 'positivo' && b.hasta <= -this.minAbsEps;
      return pos || neg;
    };
    this.histAboveThreshold = this.histBins.filter(passes).reduce((s, b) => s + b.count, 0);
    this.histData = this.histBins.map(b => ({
      label: `${passes(b) ? '● ' : ''}${b.desde.toFixed(1)} a ${b.hasta.toFixed(1)}`,
      value: b.count,
    }));
  }

  // ===== Selección enlazada (red ↔ mapa ↔ tabla) =====

  label(id: string): string {
    return this.nodeIndex.get(id)?.label ?? id;
  }

  onNode(n: RedNode | null): void {
    this.selectedNode = n;
    this.selectedEdge = null;
    this.page = 0;
    if (n) this.loadNodeCells(n);
    else this.clearMap();
  }

  onEdge(e: RedEdge | null): void {
    this.selectedEdge = e;
    if (e) {
      this.selectedNode = null;
      this.loadEdgeCells(e);
    } else {
      this.clearMap();
    }
  }

  /** Clic en una fila de la tabla: selecciona la arista y centra la red en su nodo fuente. */
  selectRow(e: RedEdge): void {
    const keepNode = this.selectedNode;
    this.onEdge(e);
    this.selectedNode = keepNode; // la tabla sigue filtrada por el nodo si lo había
    this.red?.focusNode(e.source);
  }

  clearSelection(): void {
    this.selectedNode = null;
    this.selectedEdge = null;
    this.clearMap();
  }

  private clearMap(): void {
    this.mapOcc = [];
    this.mapCounts = null;
    this.mapRun++;
  }

  private loadNodeCells(n: RedNode): void {
    this.mapLoading = true;
    this.state.cells([n.id]).subscribe({
      next: (r) => {
        const occ = n.grupo === 'fuente' ? OCC_FUENTE : OCC_DESTINO;
        this.mapOcc = (r.cells[n.id] ?? []).map(c => ({ cell_id: c, occ }));
        this.mapCounts = null;
        this.mapRun++;
        this.mapLoading = false;
      },
      error: () => { this.mapLoading = false; },
    });
  }

  private loadEdgeCells(e: RedEdge): void {
    this.mapLoading = true;
    this.state.cells([e.source, e.target]).subscribe({
      next: (r) => {
        const shared = new Set(r.interseccion ?? []);
        const fuente = (r.cells[e.source] ?? []).filter(c => !shared.has(c));
        const destino = (r.cells[e.target] ?? []).filter(c => !shared.has(c));
        this.mapOcc = [
          ...fuente.map(c => ({ cell_id: c, occ: OCC_FUENTE })),
          ...destino.map(c => ({ cell_id: c, occ: OCC_DESTINO })),
          ...[...shared].map(c => ({ cell_id: c, occ: OCC_COMPARTIDA })),
        ];
        this.mapCounts = { fuente: fuente.length, destino: destino.length, compartida: shared.size };
        this.mapRun++;
        this.mapLoading = false;
      },
      error: () => { this.mapLoading = false; },
    });
  }

  /** Vecinos del nodo seleccionado, por |ε| (panel). */
  get neighbors(): { other: string; edge: RedEdge }[] {
    const n = this.selectedNode;
    if (!n) return [];
    return this.edges
      .filter(e => e.source === n.id || e.target === n.id)
      .map(e => ({ other: e.source === n.id ? e.target : e.source, edge: e }))
      .sort((a, b) => Math.abs(b.edge.epsilon) - Math.abs(a.edge.epsilon))
      .slice(0, 100);
  }

  // ===== Tabla de aristas =====

  private tableCache: { key: string; edges: RedEdge[]; rows: RedEdge[] } | null = null;

  /** Aristas de la tabla: las del nodo seleccionado (si hay), la búsqueda y el orden.
   *  Memorizado: con miles de aristas no se reordena en cada detección de cambios. */
  get tableRows(): RedEdge[] {
    const key = `${this.selectedNode?.id ?? ''}|${this.search}|${this.sortKey}|${this.sortDesc}`;
    if (this.tableCache && this.tableCache.key === key && this.tableCache.edges === this.edges) return this.tableCache.rows;
    const rows = this.computeTableRows();
    this.tableCache = { key, edges: this.edges, rows };
    return rows;
  }

  private computeTableRows(): RedEdge[] {
    const n = this.selectedNode;
    const q = this.search.trim().toLowerCase();
    let rows = this.edges;
    if (n) rows = rows.filter(e => e.source === n.id || e.target === n.id);
    if (q) rows = rows.filter(e => this.label(e.source).toLowerCase().includes(q) || this.label(e.target).toLowerCase().includes(q));
    const key = this.sortKey;
    const dir = this.sortDesc ? -1 : 1;
    const val = (e: RedEdge) => (key === 'source' || key === 'target') ? this.label(e[key]).toLowerCase() : e[key];
    return [...rows].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
    });
  }

  get pageRows(): RedEdge[] {
    return this.tableRows.slice(this.page * PAGE_SIZE, (this.page + 1) * PAGE_SIZE);
  }

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.tableRows.length / PAGE_SIZE));
  }

  setSort(key: SortKey): void {
    if (this.sortKey === key) this.sortDesc = !this.sortDesc;
    else {
      this.sortKey = key;
      this.sortDesc = key !== 'source' && key !== 'target';
    }
    this.page = 0;
  }

  sortIcon(key: SortKey): string {
    return this.sortKey !== key ? 'unfold_more' : this.sortDesc ? 'expand_more' : 'expand_less';
  }

  get csvUrl(): string | null {
    return this.state.csvUrl(this.minAbsEps);
  }

  goBack(): void {
    this.router.navigate(['/redes/destino']);
  }

  retry(): void {
    this.generar();
  }
}
