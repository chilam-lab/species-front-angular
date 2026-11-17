import { EpsScrPayload } from '../../features/nicho-ecologico/state/nicho-analysis.models';
import type { NetPayload } from '../../features/redes/state/net-analysis.models';

/** Campos propios de una red guardada (los demás coinciden con los de Nicho). */
export type NetHistoryPayload = NetPayload & { tipo: 'redes' };

/** Info legible capturada al momento de ejecutar, para que el historial y el
 *  resumen de re-ejecutar no dependan de decodificar el payload crudo. */
export interface AnalysisHistoryMeta {
  targetSourceLabel?: string;
  region?: string;
  resolution?: string;
  /** Resumen legible de covariables (fuente + valores), como se vio en Resultados. */
  covars?: { source: string; values: string }[];

  // ===== Redes de inferencia (tipo 'redes') =====
  /** 'redes' para análisis de Redes; ausente en los de Nicho. */
  tipo?: 'redes';
  /** Fuente taxonómica (SNIB/GBIF) y región, para restaurar el área al re-ejecutar. */
  taxonomySourceId?: number;
  regionId?: number | null;
  /** Nodos fuente y destino legibles (fuente + consulta). */
  fuente?: { source: string; values: string }[];
  destino?: { source: string; values: string }[];
}

export interface AnalysisHistoryRow {
  id: number;
  uuid_redis: string;
  grid_id: number | null;
  min_occ: number | null;
  /** EpsScrPayload en Nicho; NetPayload (con tipo: 'redes') en Redes. */
  payload: EpsScrPayload & Partial<NetHistoryPayload>;
  meta: AnalysisHistoryMeta | null;
  fecha_creacion: string;
}
