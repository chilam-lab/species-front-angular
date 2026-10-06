import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { TaxonSelectorComponent } from 'taxon-selector';
import { TaxonNavigatorComponent } from 'taxon-navigator';
import { TaxonScopeComponent } from 'taxon-scope';

import { NicheAnalysisStateService } from '../state/nicho-analysis-state.service';
import { SOURCE_LABELS, TaxonSelectionPayload } from '../state/nicho-analysis.models';

@Component({
  selector: 'app-covariables-step',
  standalone: true,
  imports: [CommonModule, TaxonSelectorComponent, TaxonNavigatorComponent, TaxonScopeComponent],
  templateUrl: './covariables-step.component.html',
  styleUrls: ['./covariables-step.component.scss']
})
export class CovariablesStepComponent {
  constructor(public state: NicheAnalysisStateService, private router: Router) {}

  /** Covariables del análisis cargado con "Re-ejecutar" mientras sigan vigentes,
   *  para mostrarlas aquí (el navegador no las conoce: vienen ya armadas). */
  get preloadedCovars(): { source: string; values: string }[] {
    if (!this.state.usingPreloadedCovars) return [];
    return (this.state.preloadedPayload!.covars ?? []).map(c => ({
      source: SOURCE_LABELS[c.id_source] ?? `Fuente #${c.id_source}`,
      values: c.q || 'Sin selección'
    }));
  }

  goBack(): void {
    this.router.navigate(['/nicho-ecologico/target']);
  }

  /** Las colecciones propias se agregan desde Mi cuenta > Mis datos ("Usar como
   *  Covariable"); aquí solo se pueden quitar. */
  quitarColeccion(id_data: number): void {
    this.state.covarTerceros = this.state.covarTerceros.filter((c) => c.id_data !== id_data);
    this.state.markCovarsEdited();
    this.state.clearValidation();
  }

  onSpeciesSelected2(species: any): void {
    console.log('Especie seleccionada (Covars):', species);
  }

  onNavigatorSelectionChange2(sel: TaxonSelectionPayload | Event): void {
    const payload = sel as TaxonSelectionPayload;
    const sources = Array.isArray(payload?.sources) ? payload.sources : [];

    this.state.taxonSel2Sources = sources
      .map(src => ({
        source_id: Number(src?.source_id ?? 1),
        levels: Array.isArray(src?.levels) ? src.levels : [],
        context: src?.context
      }))
      .filter(src => src.levels.length > 0);

    // En un "Re-ejecutar", elegir aquí reemplaza las covariables del análisis cargado.
    this.state.markCovarsEdited();
    this.state.clearValidation();
  }

  goNext(): void {
    this.router.navigate(['/nicho-ecologico/resultados']);
  }
}
