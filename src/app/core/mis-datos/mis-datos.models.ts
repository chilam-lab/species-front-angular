/**
 * Fila del CSV/XLSX cargado bajo la plantilla genérica (alineada a species_v3.0):
 * solo las coordenadas son estrictamente fijas. `occurrenceid` es recomendado para
 * trazabilidad pero se autogenera si falta. Cualquier otra columna del archivo
 * (taxonomía, atributos propios, etc.) se conserva como metadato de contexto y no
 * se valida ni interpreta en el frontend.
 */
export interface OccUploadRow {
  occurrenceid: string;
  decimallatitude: string;
  decimallongitude: string;
  eventdate?: string;
  metadata: Record<string, string>;
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
