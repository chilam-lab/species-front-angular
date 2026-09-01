import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { TaxonSelectorComponent } from 'taxon-selector';
import { TaxonNavigatorComponent } from 'taxon-navigator';
import { TaxonScopeComponent } from 'taxon-scope';

import { NicheAnalysisStateService } from '../state/nicho-analysis-state.service';
import { TaxonSelectionPayload } from '../state/nicho-analysis.models';

@Component({
  selector: 'app-covariables-step',
  standalone: true,
  imports: [CommonModule, TaxonSelectorComponent, TaxonNavigatorComponent, TaxonScopeComponent],
  templateUrl: './covariables-step.component.html',
  styleUrls: ['./covariables-step.component.scss']
})
export class CovariablesStepComponent {
  constructor(public state: NicheAnalysisStateService, private router: Router) {}

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

    this.state.clearValidation();
  }

  goNext(): void {
    this.router.navigate(['/nicho-ecologico/resultados']);
  }
}
