import { EpsScrPayload } from '../../features/nicho-ecologico/state/nicho-analysis.models';

/** Info legible capturada al momento de ejecutar, para que el historial y el
 *  resumen de re-ejecutar no dependan de decodificar el payload crudo. */
export interface AnalysisHistoryMeta {
  targetSourceLabel?: string;
  region?: string;
  resolution?: string;
}

export interface AnalysisHistoryRow {
  id: number;
  uuid_redis: string;
  grid_id: number | null;
  min_occ: number | null;
  payload: EpsScrPayload;
  meta: AnalysisHistoryMeta | null;
  fecha_creacion: string;
}
