import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RegionSelectorComponent } from 'region-selector';
import { TaxonSelectorComponent } from 'taxon-selector';
import { TaxonNavigatorComponent } from 'taxon-navigator';
import { TaxonScopeComponent } from 'taxon-scope';
import { TranslatePipe } from 'taxon-shared';
import { TaxonSelectionPayload } from '../../nicho-ecologico/state/nicho-analysis.models';
import { NetAnalysisStateService, NetGroup } from '../state/net-analysis-state.service';
import { PendingNetTerceroService } from '../../../core/redes-rerun/pending-net-tercero.service';

/**
 * Paso Fuente o Destino del asistente de Redes (lo indica la ruta en data.grupo).
 * Ambos eligen variables con el mismo selector/navegador multi-fuente que las
 * covariables de Nicho; Fuente además define el área y Destino las opciones.
 */
@Component({
  selector: 'app-grupo-step',
  standalone: true,
  imports: [CommonModule, FormsModule, RegionSelectorComponent, TaxonSelectorComponent, TaxonNavigatorComponent, TaxonScopeComponent, TranslatePipe],
  templateUrl: './grupo-step.component.html',
  styleUrls: ['./grupo-step.component.scss'],
})
export class GrupoStepComponent {
  readonly state = inject(NetAnalysisStateService);
  private readonly router = inject(Router);
  readonly grupo: NetGroup = inject(ActivatedRoute).snapshot.data['grupo'] === 'destino' ? 'destino' : 'fuente';
  readonly maxYear = new Date().getFullYear();
  readonly taxonomySources = [NetAnalysisStateService.SNIB_SOURCE_ID, NetAnalysisStateService.GBIF_SOURCE_ID];

  constructor() {
    // Colecciones elegidas en Mi cuenta > Mis datos para esta red (se agregan a lo que ya hubiera).
    const pending = inject(PendingNetTerceroService).consume();
    if (pending) {
      this.state.setTerceros('fuente', [...this.state.terceros.fuente, ...pending.fuente]);
      this.state.setTerceros('destino', [...this.state.terceros.destino, ...pending.destino]);
    }
  }

  get selection() {
    return this.state.groups[this.grupo];
  }

  /** Resumen de lo elegido en este grupo (una línea por fuente). */
  get chosen(): { source: string; q: string }[] {
    return this.state.queries(this.grupo).map(q => ({ source: this.state.sourceLabel(q.id_source), q: q.q }));
  }

  // ===== Área (solo Fuente) =====
  onSourceSelected(id: number): void {
    this.state.setTaxonomySource(Number(id));
  }

  onRegionSelected(regionId: number): void {
    if (this.state.regionId === regionId) return;
    this.state.regionId = regionId;
    this.state.resolveRegionName(regionId);
    this.state.invalidate();
  }

  onResolutionSelected(resolution: string): void {
    this.state.resolution = resolution;
  }

  onGridIdSelected(gridId: number): void {
    if (this.state.gridId === gridId) return;
    this.state.gridId = gridId;
    this.state.invalidate();
  }

  // ===== Selección =====
  onNavigatorSelectionChange(sel: TaxonSelectionPayload | Event): void {
    const payload = sel as TaxonSelectionPayload;
    const sources = Array.isArray(payload?.sources) ? payload.sources : [];
    this.state.setGroupSources(this.grupo, sources
      .map(src => ({
        source_id: Number(src?.source_id ?? 1),
        levels: Array.isArray(src?.levels) ? src.levels : [],
        context: src?.context,
      }))
      .filter(src => src.levels.length > 0));
  }

  get canContinue(): boolean {
    const filtrosOk = this.state.filtersErrors(this.grupo).length === 0;
    return filtrosOk && (this.grupo === 'fuente' ? this.state.canGoToDestino() : this.state.canRun());
  }

  goBack(): void {
    this.router.navigate(['/redes/fuente']);
  }

  goNext(): void {
    if (!this.canContinue) return;
    this.router.navigate(['/redes', this.grupo === 'fuente' ? 'destino' : 'resultados']);
  }
}
