import { Component, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RedColorMode, RedEdge, RedNode, RedSpeciesComponent } from 'red-species';
import { environment } from '../../../../environments/environment';
import { SOURCE_LABELS } from '../../nicho-ecologico/state/nicho-analysis.models';

interface Caso {
  nombre: string;
  body: Record<string, unknown>;
}

const rq = (id_source: number, q: string) => ({ id_source, q, offset: 0, limit: 100000 });

/**
 * Página de prueba (fase 2) para ver la librería red-species con datos reales
 * de /mdf/getNetRelation. La reemplaza el asistente de Redes (fase 3).
 */
@Component({
  selector: 'app-red-prueba',
  standalone: true,
  imports: [CommonModule, FormsModule, RedSpeciesComponent],
  templateUrl: './red-prueba.component.html',
  styleUrls: ['./red-prueba.component.scss'],
})
export class RedPruebaComponent {
  @ViewChild(RedSpeciesComponent) red?: RedSpeciesComponent;
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiBaseUrl}/mdf`;

  readonly casos: Caso[] = [
    { nombre: 'Aedes → Lutzomyia (SNIB, 16 km)', body: { grid_id: 9, min_occ: 5, source: [rq(1, 'genero = Aedes')], target: [rq(1, 'genero = Lutzomyia')] } },
    { nombre: 'Aedes → Lutzomyia + WorldClim', body: { grid_id: 9, min_occ: 5, source: [rq(1, 'genero = Aedes')], target: [rq(1, 'genero = Lutzomyia'), rq(2, 'idfuente = 1')] } },
    { nombre: 'Mammalia → WorldClim + DEM + Uso de suelo', body: { grid_id: 9, min_occ: 5, source: [rq(1, 'clase = Mammalia')], target: [rq(2, 'idfuente = 1'), rq(4, 'idfuente = 1'), rq(5, 'idfuente = 1')] } },
  ];

  /** Aristas que se dibujan de inicio (las de mayor |ε|). */
  readonly maxEdges = 5000;
  readonly sourceLabels: Record<string, string> = Object.fromEntries(Object.entries(SOURCE_LABELS).map(([k, v]) => [k, v]));

  uuid: string | null = null;
  nodes: RedNode[] = [];
  edges: RedEdge[] = [];
  totalEdges = 0;
  stats: any = null;
  tiempos: any = null;
  minAbsEps = 2;
  colorBy: RedColorMode = 'grupo';
  loading = false;
  error: string | null = null;

  selectedNode: RedNode | null = null;
  selectedEdge: RedEdge | null = null;
  private nodeIndex = new Map<string, RedNode>();

  run(caso: Caso): void {
    this.loading = true;
    this.error = null;
    this.selectedNode = this.selectedEdge = null;
    this.http.post<any>(`${this.api}/getNetRelation`, { ...caso.body, min_abs_eps: this.minAbsEps, limit: this.maxEdges }).subscribe({
      next: (r) => {
        this.uuid = r.uuid;
        this.nodes = r.nodes;
        this.nodeIndex = new Map(this.nodes.map(n => [n.id, n]));
        this.edges = r.edges;
        this.totalEdges = r.total_edges;
        this.stats = r.stats;
        this.tiempos = r.tiempos_ms;
        this.loading = false;
      },
      error: (e) => { this.loading = false; this.error = e?.error?.error ?? 'Error al calcular la red'; },
    });
  }

  /** Otro umbral sin recalcular: pide al servidor las aristas que lo cumplen. */
  applyThreshold(): void {
    if (!this.uuid) return;
    this.loading = true;
    this.http.post<any>(`${this.api}/getNetEdges`, { uuid: this.uuid, min_abs_eps: this.minAbsEps, limit: this.maxEdges }).subscribe({
      next: (r) => { this.edges = r.edges; this.totalEdges = r.total_edges; this.loading = false; },
      error: (e) => { this.loading = false; this.error = e?.error?.error ?? 'Error al filtrar'; },
    });
  }

  label(id: string): string {
    return this.nodeIndex.get(id)?.label ?? id;
  }

  /** Vecinos del nodo seleccionado, por |ε|. */
  get neighbors(): { other: string; edge: RedEdge }[] {
    const n = this.selectedNode;
    if (!n) return [];
    return this.edges
      .filter(e => e.source === n.id || e.target === n.id)
      .map(e => ({ other: e.source === n.id ? e.target : e.source, edge: e }))
      .sort((a, b) => Math.abs(b.edge.epsilon) - Math.abs(a.edge.epsilon))
      .slice(0, 50);
  }

  onNode(n: RedNode | null): void {
    this.selectedNode = n;
    if (n) this.selectedEdge = null;
  }

  onEdge(e: RedEdge | null): void {
    this.selectedEdge = e;
    if (e) this.selectedNode = null;
  }

  csvUrl(): string {
    return `${this.api}/getNetCsv?uuid=${this.uuid}&min_abs_eps=${this.minAbsEps}`;
  }
}
