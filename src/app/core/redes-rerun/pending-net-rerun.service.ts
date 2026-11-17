import { Injectable } from '@angular/core';
import type { NetPayload } from '../../features/redes/state/net-analysis.models';
import { AnalysisHistoryMeta } from '../analysis-history/analysis-history.models';

export interface PendingNetRerun {
  payload: NetPayload;
  meta: AnalysisHistoryMeta | null;
}

/**
 * Puente entre "Mi cuenta > Historial de análisis" y el asistente de Redes,
 * igual que PendingRerunService para Nicho: NetAnalysisStateService vive solo
 * dentro de la ruta /redes, así que la red guardada se deja aquí y la consume
 * redesStepGuard al entrar a /redes/resultados.
 */
@Injectable({ providedIn: 'root' })
export class PendingNetRerunService {
  private pending: PendingNetRerun | null = null;

  set(payload: NetPayload, meta: AnalysisHistoryMeta | null): void {
    this.pending = { payload, meta };
  }

  /** Lee y limpia lo pendiente (consumo de un solo uso). */
  consume(): PendingNetRerun | null {
    const pending = this.pending;
    this.pending = null;
    return pending;
  }
}
