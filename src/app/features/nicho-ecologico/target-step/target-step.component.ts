import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { MapaMaplibreComponent } from 'mapa-maplibre';
import { RegionSelectorComponent } from 'region-selector';
import { TaxonSelectorComponent } from 'taxon-selector';
import { TaxonNavigatorComponent } from 'taxon-navigator';
import { TaxonScopeComponent } from 'taxon-scope';

import { OccService } from '../../../services/occ.service';
import { MisDatosService } from '../../../core/mis-datos/mis-datos.service';
import { PendingTerceroSelectionService } from '../../../core/nicho-rerun/pending-tercero-selection.service';
import { NicheAnalysisStateService } from '../state/nicho-analysis-state.service';
import { TaxonSelectionPayload } from '../state/nicho-analysis.models';

@Component({
  selector: 'app-target-step',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MapaMaplibreComponent, RegionSelectorComponent,
    TaxonSelectorComponent, TaxonNavigatorComponent, TaxonScopeComponent
  ],
  templateUrl: './target-step.component.html',
  styleUrls: ['./target-step.component.scss']
})
export class TargetStepComponent implements OnInit {
  constructor(
    public state: NicheAnalysisStateService,
    private occService: OccService,
    private misDatos: MisDatosService,
    private pendingTercero: PendingTerceroSelectionService,
    private router: Router
  ) {}

  /** Recoge la selección combinada hecha en "Mi cuenta > Mis datos" (botón
   *  "Usar mi selección"), que viaja por PendingTerceroSelectionService porque
   *  NicheAnalysisStateService se recrea cada vez que se entra a esta ruta. */
  ngOnInit(): void {
    const pending = this.pendingTercero.consume();
    if (!pending) return;

    if (pending.target) {
      this.state.targetTercero = pending.target;
      this.state.targetMapGenerated = false;
    }

    if (pending.covariables.length > 0) {
      const existingIds = new Set(this.state.covarTerceros.map(c => c.id_data));
      const toAdd = pending.covariables.filter(c => !existingIds.has(c.id_data));
      this.state.covarTerceros = [...this.state.covarTerceros, ...toAdd];
    }
  }

  /** Quita la colección propia usada como target y regresa al selector taxonómico. */
  useTaxonSelector(): void {
    this.state.targetTercero = null;
    this.state.targetMapGenerated = false;
    this.state.clearValidation();
  }

  /** region-selector remonta (y vuelve a emitir su selección) cada vez que se
   *  re-entra a este paso — por eso [initialSourceId/RegionId/GridId] le pasan
   *  de vuelta lo ya guardado en el state, y estos manejadores no invalidan el
   *  mapa si el valor entrante es igual al que ya había (evita que un simple
   *  "ir y volver" borre un mapa ya generado). */
  onTargetSourceSelected(sourceId: number): void {
    const next = Number(sourceId);
    if (this.state.targetSourceId === next) return;

    this.state.targetSourceId = next;
    this.state.covarsEnabledSourceIds = [
      this.state.targetSourceId,
      NicheAnalysisStateService.WORLDCLIM_SOURCE_ID,
      NicheAnalysisStateService.DEM_SOURCE_ID
    ];
    this.state.targetMapGenerated = false;
    this.state.clearValidation();
  }

  onRegionSelected(regionId: number): void {
    if (this.state.regionId === regionId) return;

    this.state.regionId = regionId;
    this.state.targetMapGenerated = false;
    this.state.clearValidation();
    this.state.resolveRegionName(this.state.targetSourceId, regionId);
  }

  onResolutionSelected(resolution: string): void {
    if (this.state.resolution === resolution) return;

    this.state.resolution = resolution;
    this.state.targetMapGenerated = false;
    this.state.clearValidation();
  }

  onGridIdSelected(gridId: number): void {
    if (this.state.gridId === gridId) return;

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

    const onSuccess = (data: { cell_id: number; occ: number }[]) => {
      this.state.occValues = data ?? [];
      this.state.runStamp++;
      this.state.isAnalyzingOcc = false;
      this.state.targetMapGenerated = true;
    };
    const onError = (err: unknown) => {
      console.error('Error al generar mapa de Target:', err);
      this.state.occValues = [];
      this.state.runStamp++;
      this.state.showValidationMessages(['Ocurrió un error al consultar datos de ocurrencia.']);
      this.state.isAnalyzingOcc = false;
    };

    if (this.state.targetTercero) {
      this.misDatos.getCells(this.state.targetTercero.id_data, this.state.gridId).subscribe({
        next: onSuccess,
        error: onError,
      });
      return;
    }

    const payload = { grid_id: this.state.gridId, array_splist, source_id: this.state.taxonSel.source_id ?? 1 };
    this.occService.getOccOnMap(payload).subscribe({
      next: ({ data }) => onSuccess(data),
      error: onError,
    });
  }

  get canAdvance(): boolean {
    if (this.state.targetTercero) return this.state.targetMapGenerated;
    const splist = this.state.buildSplistFrom(this.state.taxonSel);
    return this.state.collectValidation(this.state.gridId, splist).length === 0 && this.state.targetMapGenerated;
  }

  goNext(): void {
    if (!this.canAdvance) return;
    this.router.navigate(['/nicho-ecologico/covariables']);
  }
}
