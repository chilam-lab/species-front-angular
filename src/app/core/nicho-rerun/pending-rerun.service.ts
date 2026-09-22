import { Injectable } from '@angular/core';
import { EpsScrPayload } from '../../features/nicho-ecologico/state/nicho-analysis.models';
import { AnalysisHistoryMeta } from '../analysis-history/analysis-history.models';

export interface PendingRerun {
  payload: EpsScrPayload;
  meta: AnalysisHistoryMeta | null;
}

/**
 * Puente entre "Mi cuenta > Historial de análisis" (fuera del árbol de rutas
 * de nicho-ecologico) y el wizard de nicho-ecologico. NicheAnalysisStateService
 * vive solo dentro de la ruta 'nicho-ecologico' (se recrea cada vez que se
 * entra), así que no se puede inyectar directo desde /perfil. Este servicio
 * root guarda un payload+meta "pendiente de re-ejecutar" que
 * targetMapGeneratedGuard consume una sola vez al entrar a /nicho-ecologico/resultados.
 */
@Injectable({ providedIn: 'root' })
export class PendingRerunService {
  private pending: PendingRerun | null = null;

  set(payload: EpsScrPayload, meta: AnalysisHistoryMeta | null): void {
    this.pending = { payload, meta };
  }

  /** Lee y limpia lo pendiente (consumo de un solo uso). */
  consume(): PendingRerun | null {
    const pending = this.pending;
    this.pending = null;
    return pending;
  }
}
