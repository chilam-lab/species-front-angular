import type { RedEdge, RedNode } from 'red-species';
import type { CovariableSource, RelationQuery, TargetFilters } from '../../nicho-ecologico/state/nicho-analysis.models';

/** Selección de un grupo de nodos (fuente o destino). */
export interface NetGroupSelection {
  /** Una entrada por fuente elegida en el navegador (SNIB/GBIF, WorldClim, DEM, uso de suelo). */
  sources: CovariableSource[];
  /** Filtros de registros; solo aplican a SNIB/GBIF. */
  filters: TargetFilters;
}

/** Cuerpo de POST /mdf/getNetRelation. */
export interface NetPayload {
  grid_id: number;
  /** Mínimo de celdas de los nodos destino (nj > min_occ), como la versión estable. */
  min_occ: number;
  source: RelationQuery[];
  target: RelationQuery[];
  source_filters?: TargetFilters;
  target_filters?: TargetFilters;
  /** Umbral de |ε| de las aristas que se reciben. */
  min_abs_eps: number;
  /** Aristas que se reciben (las de mayor |ε|). */
  limit: number;
}

export interface NetHistogramBin {
  desde: number;
  hasta: number;
  count: number;
}

export interface NetStats {
  pares: number;
  destinos_validos: number;
  destinos_descartados: number;
  aristas_guardadas: number;
  min_abs_eps_guardado: number;
  truncado: boolean;
  histograma: NetHistogramBin[];
}

/** Respuesta de /mdf/getNetRelation. */
export interface NetResult {
  uuid: string;
  grid_id: number;
  n: number;
  min_occ: number;
  min_abs_eps: number;
  nodes: RedNode[];
  edges: RedEdge[];
  total_edges: number;
  stats: NetStats;
  tiempos_ms: { celdas: number; aristas: number };
}
