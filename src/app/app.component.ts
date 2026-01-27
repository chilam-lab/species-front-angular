import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { MapaMaplibreComponent  } from 'mapa-maplibre';
import { TablaSpeciesComponent } from 'tabla-species';
import { RegionSelectorComponent } from 'region-selector';
import { TaxonSelectorComponent } from 'taxon-selector';
import { TaxonNavigatorComponent } from 'taxon-navigator';
import { TaxonScopeComponent } from 'taxon-scope';
import { HistogramChartComponent } from 'histogram-chart';

import { HeaderComponent } from './layout/header/header.component';
import { SidebarComponent } from './layout/sidebar/sidebar.component';

// Servicio para SECCIÓN 1 (occ)
import { OccService } from './services/occ.service';

import { environment } from '../environments/environment';

/* ================= Tipos locales ================= */
type TaxonSelectionPayload = { levels: { level: string; values: string[] }[] };
type SplistItem = { nivel: string; valor: string };
type OccRow = { cell_id: number; occ: number };

type MapQuery = {
  regionId: number;
  resolution: string;
  taxonomy: { level: string; values: string[] }[];
};

/* === Tipos del payload del nuevo endpoint getEpsScrRelation === */
type RelationQuery = {
  id_source: number; // 1
  q: string;         // "nivel = v1, v2; otro = w1"
  offset: number;    // 0
  limit: number;     // 100000
};

type EpsScrPayload = {
  grid_id: number;
  min_occ: number;       // 5
  target: RelationQuery[];
  covars: RelationQuery[];
};

type EpsScrRelationResponse = { uuid: string };

console.log('app ENV production:', environment.production);
console.log('app API base:', environment.apiBaseUrl);


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, HeaderComponent, SidebarComponent, FormsModule,
    MapaMaplibreComponent, TablaSpeciesComponent,
    RegionSelectorComponent, TaxonSelectorComponent,
    TaxonNavigatorComponent, TaxonScopeComponent, HistogramChartComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  // =======================
  // Config/Constantes
  // =======================
  private readonly BASE_URL = environment.apiBaseUrl + '/mdf';

  // sidebar colapsado por defecto
  sidebarCollapsed = true;

  // =======================
  // FLAGS DE LOADING
  // =======================
  isAnalyzingOcc = false;    // sección 1
  isAnalyzingNiche = false;  // sección 2

  /** Resultados completos (filas crudas) */
  tableRows: any[] = [];

  /** Datos para histograma de deciles (nuevo) */
  scoreDeciles: { decil: number; avg_score_cell: number; cell_count: number }[] = [];
  decileHistogramData: { label: string; value: number }[] = [];
  

  layoutSplit: '40-60' | '50-50' = '40-60';

  // =======================
  // SECCIÓN 1 (TARGET)
  // =======================
  regionId: number | null = null;
  resolution: string | null = null;
  gridId: number | null = null;      // malla base
  taxonSel: TaxonSelectionPayload = { levels: [] };

  mapQuery?: MapQuery;
  runStamp = 0;
  occValues: OccRow[] = [];

  // =======================
  // SECCIÓN 2 (COVARIABLES)
  // =======================
  regionId2: number | null = null;
  resolution2: string | null = null;
  gridId2: number | null = null;   // no se usa; se toma gridId (Target)
  taxonSel2: TaxonSelectionPayload = { levels: [] };

  // ==== HISTOGRAMAS ====
  /** uuid resultante de getEpsScrRelation; cuando existe, se pintan los histogramas */
  uuidNiche: string | null = null;
  /** número de rangos para histogramas (default 10) */
  histogramBuckets = 10;

  // NUEVO: decil seleccionado para la tabla
  selectedDecile = 10;

  // Referencia al mapa de la sección 2
  @ViewChild('mapNiche') mapNiche?: MapaMaplibreComponent;

  // ==== UI de validación (común) ====
  showValidation = false;
  validationMessages: string[] = [];

  constructor(
    private occService: OccService,
    private http: HttpClient
  ) {}

  // ---------- utils ----------
  private isTaxonSelectionPayload(obj: any): obj is TaxonSelectionPayload {
    return !!obj && Array.isArray(obj.levels);
  }

  private buildSplistFrom(payload: TaxonSelectionPayload): SplistItem[] {
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

  private collectValidation(gridId: number | null, splist: SplistItem[]): string[] {
    const msgs: string[] = [];
    if (!gridId || gridId <= 0) msgs.push('Selecciona una región y una resolución (gridId inválido).');
    if (splist.length === 0) msgs.push('Selecciona al menos un taxón en el navegador.');
    return msgs;
  }

  private showValidationMessages(msgs: string[]) {
    this.validationMessages = msgs;
    this.showValidation = msgs.length > 0;
  }

  private clearValidation() {
    this.showValidation = false;
    this.validationMessages = [];
  }

  private buildQFromSplist(items: SplistItem[]): string {
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

  /**
   * NUEVO:
   * Construye los datos para el histograma de deciles
   * usando tableRows (la misma fuente que usas para la tabla de deciles).
   *
   * Asume que en cada fila:
   *  - el decil viene en r.decil (o r.decile)
   *  - el score por celda viene en r.score_cell (o r.score)
   *
   * Ajusta los nombres de los campos si en tu JSON real se llaman distinto.
   */
  private buildDecileHistogramFromTable() {
    const rows = Array.isArray(this.tableRows) ? this.tableRows : [];
    const groups = new Map<number, { sum: number; count: number }>();

    for (const r of rows) {
      // Intenta diferentes nombres por si cambia el backend
      const decRaw =
        (r as any).decil ??
        (r as any).decile ??
        (r as any).dec ??
        null;

      const dec = Number(decRaw);
      if (!dec || Number.isNaN(dec)) continue;

      const scoreRaw =
        (r as any).score_cell ??
        (r as any).score ??
        (r as any).score_mean ??
        0;

      const score = Number(scoreRaw);
      if (Number.isNaN(score)) continue;

      const g = groups.get(dec) ?? { sum: 0, count: 0 };
      g.sum += score;
      g.count++;
      groups.set(dec, g);

      
    }

    const data: { label: string; value: number }[] = [];

    // Queremos mostrar del decil 10 al 1
    for (let dec = 10; dec >= 1; dec--) {
      const g = groups.get(dec);
      if (!g || g.count === 0) continue;
      const avg = g.sum / g.count;
      data.push({
        label: dec.toString(),          // eje X: "10", "9", ..., "1"
        value: +avg.toFixed(2)          // promedio de score por celda redondeado
      });
    }

    this.decileHistogramData = data;
  }

  // ---------- handlers COMUNES ----------
  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  // ---------- handlers SECCIÓN 1 (Target) ----------
  onRegionSelected(regionId: number) {
    this.regionId = regionId;
    this.clearValidation();
  }

  onResolutionSelected(resolution: string) {
    this.resolution = resolution;
    this.clearValidation();
  }

  onGridIdSelected(gridId: number) {
    this.gridId = gridId;
    this.clearValidation();
  }

  onSpeciesSelected(species: any) {
    console.log('Especie seleccionada (Target):', species);
  }

  onNavigatorSelectionChange(sel: TaxonSelectionPayload | Event) {
    let normalized: TaxonSelectionPayload | null = null;
    if (this.isTaxonSelectionPayload(sel)) {
      normalized = sel;
    } else if (sel && typeof sel === 'object' && 'levels' in (sel as any)) {
      normalized = (sel as any) as TaxonSelectionPayload;
    }
    if (!normalized) return;

    const cloned = JSON.parse(JSON.stringify(normalized)) as TaxonSelectionPayload;
    cloned.levels = Array.isArray(cloned.levels) ? cloned.levels : [];
    this.taxonSel = cloned;

    this.clearValidation();
  }

  onVisualize() {
    const array_splist = this.buildSplistFrom(this.taxonSel);
    const missing = this.collectValidation(this.gridId, array_splist);
    if (missing.length > 0) {
      this.showValidationMessages(missing);
      return;
    }

    this.clearValidation();
    if (!this.gridId) return;

    this.isAnalyzingOcc = true;

    this.mapQuery = {
      regionId: this.regionId ?? -1,
      resolution: this.resolution ?? '',
      taxonomy: this.taxonSel.levels
    };

    const payload = { grid_id: this.gridId, array_splist };
    this.occService.getOccOnMap(payload).subscribe({
      next: ({ data }) => {
        this.occValues = data ?? [];
        this.runStamp++;
        this.isAnalyzingOcc = false;
      },
      error: (err) => {
        console.error('getOccOnMap error:', err);
        this.occValues = [];
        this.runStamp++;
        this.showValidationMessages(['Ocurrió un error al consultar datos de ocurrencia.']);
        this.isAnalyzingOcc = false;
      }
    });
  }

  // ---------- handlers SECCIÓN 2 (Covariables) ----------
  onRegionSelected2(regionId: number) {
    this.regionId2 = regionId;
    this.clearValidation();
  }
  onResolutionSelected2(resolution: string) {
    this.resolution2 = resolution;
    this.clearValidation();
  }
  onGridIdSelected2(gridId: number) {
    this.gridId2 = gridId;
    this.clearValidation();
  }
  onSpeciesSelected2(species: any) {
    console.log('Especie seleccionada (Covars):', species);
  }

  onNavigatorSelectionChange2(sel: TaxonSelectionPayload | Event) {
    let normalized: TaxonSelectionPayload | null = null;
    if (this.isTaxonSelectionPayload(sel)) {
      normalized = sel;
    } else if (sel && typeof sel === 'object' && 'levels' in (sel as any)) {
      normalized = (sel as any) as TaxonSelectionPayload;
    }
    if (!normalized) return;

    const cloned = JSON.parse(JSON.stringify(normalized)) as TaxonSelectionPayload;
    cloned.levels = Array.isArray(cloned.levels) ? cloned.levels : [];
    this.taxonSel2 = cloned;

    this.clearValidation();
  }

  /** Botón: arma el payload para getEpsScrRelation, obtiene el uuid y llama al mapa 2 */
  onVisualizeNicho() {
    if (!this.gridId) {
      this.showValidationMessages(['Selecciona región y resolución en Target (Sección 1).']);
      return;
    }

    // Target (S1)
    const splistTarget = this.buildSplistFrom(this.taxonSel);
    // Covars (S2)
    const splistCovars = this.buildSplistFrom(this.taxonSel2);

    const errs: string[] = [];
    if (splistTarget.length === 0) errs.push('Selecciona al menos un taxón en Target.');
    if (splistCovars.length === 0) errs.push('Selecciona al menos un taxón en Covariables.');
    if (errs.length) {
      this.showValidationMessages(errs);
      return;
    }

    const qTarget = this.buildQFromSplist(splistTarget);
    const qCovars = this.buildQFromSplist(splistCovars);

    const rq = (q: string): RelationQuery => ({ id_source: 1, q, offset: 0, limit: 100000 });

    const payload: EpsScrPayload = {
      grid_id: this.gridId!,
      min_occ: 5,
      target: [rq(qTarget)],
      covars: [rq(qCovars)]
    };

    console.log('[App] EpsScr payload ->', payload);

    this.isAnalyzingNiche = true;

    // 1) Disparo el mapa 2 (tu flujo ya existente)
    if (this.mapNiche?.getEpsScrRelation) {
      if ((this.mapNiche as any).setLoading) {
        (this.mapNiche as any).setLoading(true);
      }
      this.mapNiche.getEpsScrRelation(payload);
    } else {
      console.warn('getEpsScrRelation no existe en app-mapa-maplibre.');
      this.showValidationMessages(['No se encontró getEpsScrRelation en el mapa de Covariables.']);
      this.isAnalyzingNiche = false;
      return;
    }

    // 2) Obtengo el uuid para los histogramas
    this.http.post<EpsScrRelationResponse & { scoreDeciles: any[] }>(`${this.BASE_URL}/getEpsScrRelation`,
      payload
    ).subscribe({
      next: (res) => {
        this.uuidNiche = res?.uuid ?? null;
        this.selectedDecile = 10;

        // Guardar deciles del backend
        this.scoreDeciles = Array.isArray((res as any).scoreDeciles) ? (res as any).scoreDeciles : [];

        // Transformar para el histograma (10 → 1)
        this.decileHistogramData = this.scoreDeciles
          .slice()
          .sort((a, b) => b.decil - a.decil)
          .map(d => ({
            label: d.decil.toString(),
            value: +d.avg_score_cell.toFixed(2)
          }));
        
        console.log('decileHistogramData:', this.decileHistogramData);
        
      },
      error: (err) => {
        console.error('getEpsScrRelation (uuid) error:', err);
        this.uuidNiche = null; // si falla, escondemos los histogramas
      }
    });

  }

  /** Callback que tu mapa 2 debe emitir cuando termina el análisis */
  onEpsScrRelReady(rows: any[]) {
    this.tableRows = Array.isArray(rows) ? rows : [];

    // 👇 QUITAR esta línea (es la que te borra el histograma)
    // this.buildDecileHistogramFromTable();

    if (this.mapNiche && (this.mapNiche as any).setLoading) {
      (this.mapNiche as any).setLoading(false);
    }
    this.isAnalyzingNiche = false;
  }

}
