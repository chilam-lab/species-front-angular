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
  id_source: number | 'terceros';
  q: string;         // "nivel = v1, v2; otro = w1" (o etiqueta legible para 'terceros')
  offset: number;
  limit: number;
  /** Solo cuando id_source === 'terceros': id de lista_carga_terceros. */
  id_data?: number;
};

/** Una colección propia ("Mis datos") elegida como target o covariable. */
export type TerceroSelection = { id_data: number; nombre_datos: string };

/** Filtros de ocurrencias del target (sección Target). Por defecto no
 *  filtran nada: sin rango de años, incluye registros sin fecha y fósiles. */
export type TargetFilters = {
  fecha_inicio: number | null;
  fecha_fin: number | null;
  sin_fecha: boolean;   // incluir registros sin fecha
  fosil: boolean;       // incluir fósiles
};

export const DEFAULT_TARGET_FILTERS: TargetFilters = {
  fecha_inicio: null, fecha_fin: null, sin_fecha: true, fosil: true,
};

export type EpsScrPayload = {
  grid_id: number;
  min_occ: number;
  target: RelationQuery[];
  covars: RelationQuery[];
  /** Opciones del análisis (sección Covariables). Ausentes en análisis
   *  guardados antes de que existieran = sin filtro / sin a priori. */
  min_nj?: number;      // covariables en menos de min_nj celdas se descartan (0 = sin filtro)
  apriori?: boolean;    // score por celda + ln(ni/(n-ni))
  mapa_prob?: boolean;  // mapa de probabilidad (logística del score con a priori)
  /** Filtros del target; ausentes = sin filtro. */
  target_filters?: TargetFilters;
};

export type EpsScrRelationResponse = { uuid: string };

export type CovariableSource = {
  source_id: number;
  levels: { level: string; values: string[] }[];
  context?: { idfuente?: number; layer?: string };
};

/** Catálogo estático de fuentes ya usado en la app (ver WORLDCLIM_SOURCE_ID/DEM_SOURCE_ID
 * previos en app.component.ts) — solo para etiquetas legibles en el resumen de Resultados. */
export const SOURCE_LABELS: Record<number | string, string> = {
  1: 'SNIB',
  2: 'WorldClim',
  3: 'GBIF',
  4: 'DEM',
  terceros: 'Mis datos'
};
