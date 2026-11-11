import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RedColorMode, RedEdge, RedNode, RedSpeciesComponent } from 'red-species';
import { I18nService, TranslatePipe } from 'taxon-shared';
import { SOURCE_LABELS } from '../../nicho-ecologico/state/nicho-analysis.models';
import { NetAnalysisStateService } from '../state/net-analysis-state.service';

type Signo = 'ambos' | 'positivo' | 'negativo';

/**
 * Resultados de la red: se calcula al entrar (solo si la configuración cambió
 * desde el último cálculo) y se explora sin recalcular: umbral de |ε| y signo
 * piden otras aristas a /mdf/getNetEdges.
 */
@Component({
  selector: 'app-redes-resultados-step',
  standalone: true,
  imports: [CommonModule, FormsModule, RedSpeciesComponent, TranslatePipe],
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

  edges: RedEdge[] = [];
  totalEdges = 0;
  minAbsEps = 2;
  signo: Signo = 'ambos';
  colorBy: RedColorMode = 'grupo';
  filtering = false;

  selectedNode: RedNode | null = null;
  selectedEdge: RedEdge | null = null;
  private nodeIndex = new Map<string, RedNode>();

  ngOnInit(): void {
    const payload = this.state.buildPayload();
    if (!payload) {
      this.router.navigate(['/redes/destino']);
      return;
    }
    // Misma configuración que el último cálculo: se reutiliza (vigente 1 h en el servidor).
    if (this.state.result && JSON.stringify(payload) === JSON.stringify(this.state.lastPayload)) {
      this.showResult();
      return;
    }
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

  private showResult(): void {
    const r = this.state.result!;
    this.nodeIndex = new Map(r.nodes.map(n => [n.id, n]));
    this.edges = r.edges;
    this.totalEdges = r.total_edges;
    this.minAbsEps = r.min_abs_eps;
    this.signo = 'ambos';
  }

  /** Otro umbral o signo, sin recalcular la red. */
  applyFilter(): void {
    if (!this.state.result) return;
    this.filtering = true;
    this.state.edges(this.minAbsEps, this.signo).subscribe({
      next: (r) => { this.edges = r.edges; this.totalEdges = r.total_edges; this.filtering = false; },
      error: (e) => {
        this.filtering = false;
        this.state.error = e?.error?.codigo === 'expirado' ? this.i18n.t('red.r.expired') : this.i18n.t('red.r.error');
      },
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
      .slice(0, 100);
  }

  onNode(n: RedNode | null): void {
    this.selectedNode = n;
    if (n) this.selectedEdge = null;
  }

  onEdge(e: RedEdge | null): void {
    this.selectedEdge = e;
    if (e) this.selectedNode = null;
  }

  get csvUrl(): string | null {
    return this.state.csvUrl(this.minAbsEps);
  }

  goBack(): void {
    this.router.navigate(['/redes/destino']);
  }

  retry(): void {
    this.state.lastPayload = null;
    this.ngOnInit();
  }
}
