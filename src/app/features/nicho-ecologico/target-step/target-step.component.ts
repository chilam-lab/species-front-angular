import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { MapaMaplibreComponent } from 'mapa-maplibre';
import { RegionSelectorComponent } from 'region-selector';
import { TaxonSelectorComponent } from 'taxon-selector';
import { TaxonNavigatorComponent } from 'taxon-navigator';
import { TaxonScopeComponent } from 'taxon-scope';

import { OccService } from '../../../services/occ.service';
import { NicheAnalysisStateService } from '../state/nicho-analysis-state.service';
import { TaxonSelectionPayload } from '../state/nicho-analysis.models';

@Component({
  selector: 'app-target-step',
  standalone: true,
  imports: [
    CommonModule, MapaMaplibreComponent, RegionSelectorComponent,
    TaxonSelectorComponent, TaxonNavigatorComponent, TaxonScopeComponent
  ],
  templateUrl: './target-step.component.html',
  styleUrls: ['./target-step.component.scss']
})
export class TargetStepComponent {
  constructor(
    public state: NicheAnalysisStateService,
    private occService: OccService,
    private router: Router
  ) {}

  onTargetSourceSelected(sourceId: number): void {
    this.state.targetSourceId = Number(sourceId);
    this.state.covarsEnabledSourceIds = [
      this.state.targetSourceId,
      NicheAnalysisStateService.WORLDCLIM_SOURCE_ID,
      NicheAnalysisStateService.DEM_SOURCE_ID
    ];
    this.state.targetMapGenerated = false;
    this.state.clearValidation();
  }

  onRegionSelected(regionId: number): void {
    this.state.regionId = regionId;
    this.state.targetMapGenerated = false;
    this.state.clearValidation();
    this.state.resolveRegionName(this.state.targetSourceId, regionId);
  }

  onResolutionSelected(resolution: string): void {
    this.state.resolution = resolution;
    this.state.targetMapGenerated = false;
    this.state.clearValidation();
  }

  onGridIdSelected(gridId: number): void {
    this.state.gridId = gridId;
    this.state.targetMapGenerated = false; // cambiar la malla invalida el mapa ya generado
    this.state.clearValidation();
  }

  onSpeciesSelected(species: any): void {
    console.log('Especie seleccionada (Target):', species);
  }

  onNavigatorSelectionChange(sel: TaxonSelectionPayload | Event): void {
    const payload = sel as TaxonSelectionPayload;

    if (Array.isArray(payload?.sources) && payload.sources.length > 0) {
      const first = payload.sources[0];
      this.state.taxonSel = {
        levels: Array.isArray(first?.levels) ? first.levels : [],
        source_id: Number(first?.source_id ?? 1)
      };
      this.state.targetMapGenerated = false;
      this.state.clearValidation();
      return;
    }

    let normalized: TaxonSelectionPayload | null = null;
    if (this.state.isTaxonSelectionPayload(sel)) {
      normalized = sel;
    } else if (sel && typeof sel === 'object' && 'levels' in (sel as any)) {
      normalized = (sel as any) as TaxonSelectionPayload;
    }
    if (!normalized) return;

    const cloned = JSON.parse(JSON.stringify(normalized)) as TaxonSelectionPayload;
    cloned.levels = Array.isArray(cloned.levels) ? cloned.levels : [];
    this.state.taxonSel = cloned;
    this.state.targetMapGenerated = false;

    this.state.clearValidation();
  }

  onVisualize(): void {
    const array_splist = this.state.buildSplistFrom(this.state.taxonSel);
    const missing = this.state.collectValidation(this.state.gridId, array_splist);
    if (missing.length > 0) {
      this.state.showValidationMessages(missing);
      return;
    }

    this.state.clearValidation();
    if (!this.state.gridId) return;

    this.state.isAnalyzingOcc = true;

    this.state.mapQuery = {
      regionId: this.state.regionId ?? -1,
      resolution: this.state.resolution ?? '',
      taxonomy: this.state.taxonSel.levels ?? []
    };

    const payload = { grid_id: this.state.gridId, array_splist, source_id: this.state.taxonSel.source_id ?? 1 };
    this.occService.getOccOnMap(payload).subscribe({
      next: ({ data }) => {
        this.state.occValues = data ?? [];
        this.state.runStamp++;
        this.state.isAnalyzingOcc = false;
        this.state.targetMapGenerated = true;
      },
      error: (err) => {
        console.error('getOccOnMap error:', err);
        this.state.occValues = [];
        this.state.runStamp++;
        this.state.showValidationMessages(['Ocurrió un error al consultar datos de ocurrencia.']);
        this.state.isAnalyzingOcc = false;
      }
    });
  }

  get canAdvance(): boolean {
    const splist = this.state.buildSplistFrom(this.state.taxonSel);
    return this.state.collectValidation(this.state.gridId, splist).length === 0 && this.state.targetMapGenerated;
  }

  goNext(): void {
    if (!this.canAdvance) return;
    this.router.navigate(['/nicho-ecologico/covariables']);
  }
}
