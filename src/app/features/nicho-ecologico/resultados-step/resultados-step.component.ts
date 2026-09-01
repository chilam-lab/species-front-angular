import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { MapaMaplibreComponent } from 'mapa-maplibre';
import { TablaSpeciesComponent } from 'tabla-species';
import { HistogramChartComponent } from 'histogram-chart';

import { NicheAnalysisStateService } from '../state/nicho-analysis-state.service';
import { SOURCE_LABELS } from '../state/nicho-analysis.models';

@Component({
  selector: 'app-resultados-step',
  standalone: true,
  imports: [CommonModule, FormsModule, MapaMaplibreComponent, TablaSpeciesComponent, HistogramChartComponent],
  templateUrl: './resultados-step.component.html',
  styleUrls: ['./resultados-step.component.scss']
})
export class ResultadosStepComponent {
  @ViewChild('mapNiche') mapNiche?: MapaMaplibreComponent;

  histogramBuckets = 10;

  constructor(public state: NicheAnalysisStateService, private router: Router) {}

  goBack(): void {
    this.router.navigate(['/nicho-ecologico/covariables']);
  }

  get targetSourceLabel(): string {
    const id = this.state.targetSourceId;
    return id != null ? (SOURCE_LABELS[id] ?? `Fuente #${id}`) : '—';
  }

  get regionDisplay(): string {
    if (this.state.regionName) return this.state.regionName;
    return this.state.regionId != null ? `Región #${this.state.regionId}` : '—';
  }

  get targetTaxonSummary(): string {
    const levels = this.state.taxonSel?.levels ?? [];
    if (levels.length === 0) return 'Sin selección';
    return levels
      .map(l => `${l.level}: ${(l.values ?? []).join(', ')}`)
      .join(' · ');
  }

  get covariablesSummary(): { source: string; values: string }[] {
    return this.state.taxonSel2Sources.map(src => {
      const label = SOURCE_LABELS[src.source_id] ?? `Fuente #${src.source_id}`;
      if (src.context?.idfuente != null || src.context?.layer) {
        const parts = [
          src.context?.idfuente != null ? `variable ${src.context.idfuente}` : null,
          src.context?.layer ? `capa ${src.context.layer}` : null
        ].filter(Boolean);
        return { source: label, values: parts.join(' · ') || 'Sin selección' };
      }
      const values = src.levels.map(l => `${l.level}: ${(l.values ?? []).join(', ')}`).join(' · ');
      return { source: label, values: values || 'Sin selección' };
    });
  }

  get canRunAnalysis(): boolean {
    return this.state.canRunAnalysis();
  }

  /** Botón "Ejecutar Análisis": arma el payload (misma lógica que antes tenía
   *  onVisualizeNicho() en el componente monolítico) y dispara el mapa de coocurrencias. */
  ejecutarAnalisis(): void {
    const payload = this.state.buildEpsScrPayload();
    if (!payload) return; // buildEpsScrPayload ya dejó validationMessages listos

    this.state.isAnalyzingNiche = true;

    if (this.mapNiche?.getEpsScrRelation) {
      (this.mapNiche as any).setLoading?.(true);
      this.mapNiche.getEpsScrRelation(payload);
    } else {
      console.warn('getEpsScrRelation no existe en app-mapa-maplibre.');
      this.state.showValidationMessages(['No se encontró getEpsScrRelation en el mapa de Resultados.']);
      this.state.isAnalyzingNiche = false;
    }
  }

  onEpsScrRelReady(rows: any[]): void {
    console.log('[ResultadosStep] onEpsScrRelReady llamado con', rows?.length, 'filas');
    this.state.tableRows = Array.isArray(rows) ? rows : [];
    (this.mapNiche as any)?.setLoading?.(false);
    this.state.isAnalyzingNiche = false;
    console.log('[ResultadosStep] state.isAnalyzingNiche ahora es', this.state.isAnalyzingNiche);
  }

  onEpsScrExtrasReady(extras: { uuid: string | null; scoreDeciles: any[] }): void {
    console.log('[ResultadosStep] onEpsScrExtrasReady llamado con uuid', extras?.uuid);
    this.state.uuidNiche = extras?.uuid ?? null;
    this.state.selectedDecile = 10;
    this.state.scoreDeciles = Array.isArray(extras?.scoreDeciles) ? extras.scoreDeciles : [];
    this.state.decileHistogramData = this.state.scoreDeciles
      .slice()
      .sort((a, b) => b.decil - a.decil)
      .map(d => ({ label: d.decil.toString(), value: +d.avg_score_cell.toFixed(2) }));
  }
}
