import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { MapaMaplibreComponent } from 'mapa-maplibre';
import { TablaSpeciesComponent } from 'tabla-species';
import { HistogramChartComponent } from 'histogram-chart';

import { NicheAnalysisStateService } from '../state/nicho-analysis-state.service';
import { SOURCE_LABELS } from '../state/nicho-analysis.models';
import { AuthService } from '../../../core/auth/auth.service';

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

  constructor(public state: NicheAnalysisStateService, private router: Router, private auth: AuthService) {}

  goBack(): void {
    this.router.navigate(['/nicho-ecologico/covariables']);
  }

  /** Todos los getters de resumen tienen fallback a preloadedPayload/preloadedMeta
   *  porque en un "Re-ejecutar" desde el Historial (Mi cuenta) nunca se pasó por
   *  Target/Covariables, así que taxonSel/taxonSel2Sources quedan vacíos. */

  get targetSourceLabel(): string {
    if (this.state.preloadedMeta?.targetSourceLabel) return this.state.preloadedMeta.targetSourceLabel;
    const id = this.state.targetSourceId;
    return id != null ? (SOURCE_LABELS[id] ?? `Fuente #${id}`) : '—';
  }

  get regionDisplay(): string {
    if (this.state.preloadedMeta?.region) return this.state.preloadedMeta.region;
    if (this.state.regionName) return this.state.regionName;
    return this.state.regionId != null ? `Región #${this.state.regionId}` : '—';
  }

  get resolutionDisplay(): string {
    return this.state.preloadedMeta?.resolution ?? this.state.resolution ?? '—';
  }

  get targetTaxonSummary(): string {
    if (this.state.preloadedPayload) {
      return this.state.preloadedPayload.target?.[0]?.q || 'Sin selección';
    }
    const levels = this.state.taxonSel?.levels ?? [];
    if (levels.length === 0) return 'Sin selección';
    return levels
      .map(l => `${l.level}: ${(l.values ?? []).join(', ')}`)
      .join(' · ');
  }

  get covariablesSummary(): { source: string; values: string }[] {
    if (this.state.preloadedPayload) {
      return (this.state.preloadedPayload.covars ?? []).map(c => ({
        source: SOURCE_LABELS[c.id_source] ?? `Fuente #${c.id_source}`,
        values: c.q || 'Sin selección'
      }));
    }
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
      // mapNiche reenvía este objeto tal cual como body del POST a
      // /mdf/getEpsScrRelation (ver mapa-maplibre.service getEpsScrRelationUnified) —
      // agregamos sessionid (para que middleware_datasources resuelva el usuario
      // autenticado) y meta (fuente/región/resolución legibles para el historial;
      // si venimos de un re-ejecutar, se reusa la meta original en vez de
      // reconstruirla, porque targetSourceId/regionName quedan vacíos en ese flujo).
      const meta = this.state.preloadedMeta ?? {
        targetSourceLabel: this.targetSourceLabel,
        region: this.regionDisplay,
        resolution: this.resolutionDisplay,
      };
      const payloadConSesion = { ...payload, sessionid: this.auth.sessionIdOrNull, meta };
      this.mapNiche.getEpsScrRelation(payloadConSesion);
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
