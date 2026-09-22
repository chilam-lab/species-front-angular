/** Fila del CSV/XLSX cargado, ya mapeada a las columnas fijas de la plantilla. */
export interface OccUploadRow {
  occurrenceid: string;
  decimallatitude: string;
  decimallongitude: string;
  eventdate?: string;
  kingdom: string;
  phylum: string;
  class: string;
  order: string;
  family: string;
  genus?: string;
  species?: string;
  scientificname?: string;
  taxonrank: string;
}

export interface UploadCollectionPayload {
  nombre_coleccion: string;
  json_data: OccUploadRow[];
}

export interface DataCollectionRow {
  id: number;
  userid: number;
  nombre_datos: string;
  estatus: string;
  categoria: string;
  fecha_carga: string;
  fecha_expiracion: string;
  tipo_info: string;
}
