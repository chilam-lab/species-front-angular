export type TaxonSelectionPayload = {
  levels: { level: string; values: string[] }[];
  source_id?: number;
  sources?: {
    source_id: number;
    source_name: string;
    levels: { level: string; values: string[] }[];
    context?: { idfuente?: number; layer?: string };
  }[];
};

export type SplistItem = { nivel: string; valor: string };
export type OccRow = { cell_id: number; occ: number };

export type MapQuery = {
  regionId: number;
  resolution: string;
  taxonomy: { level: string; values: string[] }[];
};

/* === Tipos del payload del endpoint getEpsScrRelation === */
export type RelationQuery = {
  id_source: number;
  q: string;         // "nivel = v1, v2; otro = w1"
  offset: number;
  limit: number;
};

export type EpsScrPayload = {
  grid_id: number;
  min_occ: number;
  target: RelationQuery[];
  covars: RelationQuery[];
};

export type EpsScrRelationResponse = { uuid: string };

export type CovariableSource = {
  source_id: number;
  levels: { level: string; values: string[] }[];
  context?: { idfuente?: number; layer?: string };
};

/** Catálogo estático de fuentes ya usado en la app (ver WORLDCLIM_SOURCE_ID/DEM_SOURCE_ID
 * previos en app.component.ts) — solo para etiquetas legibles en el resumen de Resultados. */
export const SOURCE_LABELS: Record<number, string> = {
  1: 'SNIB',
  2: 'WorldClim',
  3: 'GBIF',
  4: 'DEM'
};
