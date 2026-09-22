import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { MisDatosService } from '../../../../core/mis-datos/mis-datos.service';
import { DataCollectionRow, OccUploadRow } from '../../../../core/mis-datos/mis-datos.models';

const CHAR_FORMAT = /[`!@#$%^&*()+=\[\]{};'"\\|,<>?~]/;
const REQUIRED_FIELDS: (keyof OccUploadRow)[] = ['occurrenceid', 'kingdom', 'phylum', 'class', 'order', 'family', 'taxonrank'];
const TAXON_RANKS = ['family', 'genus', 'species'];

export const TEMPLATE_COLUMNS = [
  { name: 'occurrenceid', tipo: 'texto', comentario: 'Requerido, id propio (solo letras, números, guiones medios y bajos)' },
  { name: 'decimallatitude', tipo: 'decimal', comentario: 'Requerido' },
  { name: 'decimallongitude', tipo: 'decimal', comentario: 'Requerido' },
  { name: 'eventdate', tipo: 'texto', comentario: 'Opcional, formato: dd/mm/aaaa' },
  { name: 'kingdom', tipo: 'texto', comentario: 'Requerido' },
  { name: 'phylum', tipo: 'texto', comentario: 'Requerido' },
  { name: 'class', tipo: 'texto', comentario: 'Requerido' },
  { name: 'order', tipo: 'texto', comentario: 'Requerido' },
  { name: 'family', tipo: 'texto', comentario: 'Requerido' },
  { name: 'genus', tipo: 'texto', comentario: 'Opcional' },
  { name: 'species', tipo: 'texto', comentario: 'Opcional, llenar con género + epíteto. Ej: Lynx rufus' },
  { name: 'scientificname', tipo: 'texto', comentario: 'Opcional' },
  { name: 'taxonrank', tipo: 'texto', comentario: 'Requerido, valores: family, genus, species' },
];

function isNumeric(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  return !isNaN(value as any) && !isNaN(parseFloat(value as string));
}

function validateRows(rows: OccUploadRow[]): string[] {
  const errors: string[] = [];

  rows.forEach((item, index) => {
    const line = index + 1;

    if (!item.occurrenceid || CHAR_FORMAT.test(item.occurrenceid)) {
      errors.push(`Línea ${line}: occurrenceid inválido o vacío.`);
    }
    if (!isNumeric(item.decimallatitude)) {
      errors.push(`Línea ${line}: decimallatitude no es un número válido.`);
    }
    if (!isNumeric(item.decimallongitude)) {
      errors.push(`Línea ${line}: decimallongitude no es un número válido.`);
    }

    (['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species', 'scientificname', 'taxonrank'] as (keyof OccUploadRow)[]).forEach((field) => {
      const value = item[field];
      if (value && CHAR_FORMAT.test(String(value))) {
        errors.push(`Línea ${line}: ${field} tiene caracteres inválidos.`);
      }
    });

    REQUIRED_FIELDS.forEach((field) => {
      if (!item[field]) {
        errors.push(`Línea ${line}: falta el campo requerido ${field}.`);
      }
    });

    if (item.taxonrank && !TAXON_RANKS.includes(item.taxonrank)) {
      errors.push(`Línea ${line}: taxonrank debe ser family, genus o species.`);
    }
  });

  return errors;
}

@Component({
  selector: 'app-mis-datos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mis-datos.component.html',
  styleUrls: ['./mis-datos.component.scss']
})
export class MisDatosComponent implements OnInit {
  readonly templateColumns = TEMPLATE_COLUMNS;

  nombreColeccion = '';
  fileName: string | null = null;
  parsedRows: OccUploadRow[] = [];
  validationErrors: string[] = [];

  collections: DataCollectionRow[] = [];
  loadingList = true;
  submitting = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;

  constructor(private misDatos: MisDatosService) {}

  ngOnInit(): void {
    this.loadCollections();
  }

  loadCollections(): void {
    this.loadingList = true;
    this.misDatos.list().subscribe({
      next: (rows) => {
        this.collections = rows;
        this.loadingList = false;
      },
      error: () => {
        this.errorMessage = 'No se pudo cargar la lista de colecciones.';
        this.loadingList = false;
      },
    });
  }

  onFileSelected(event: Event): void {
    this.successMessage = null;
    this.errorMessage = null;
    this.parsedRows = [];
    this.validationErrors = [];

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.fileName = file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });

        this.parsedRows = raw.map((row) => this.mapRow(row));
        this.validationErrors = validateRows(this.parsedRows);
      } catch (err) {
        this.errorMessage = 'No se pudo leer el archivo. Verifica que sea un .csv, .xls o .xlsx válido.';
      }
    };
    reader.readAsArrayBuffer(file);
  }

  private mapRow(row: Record<string, unknown>): OccUploadRow {
    const norm: Record<string, unknown> = {};
    for (const key of Object.keys(row)) {
      norm[key.trim().toLowerCase()] = row[key];
    }
    const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
    return {
      occurrenceid: str(norm['occurrenceid']),
      decimallatitude: str(norm['decimallatitude']),
      decimallongitude: str(norm['decimallongitude']),
      eventdate: str(norm['eventdate']),
      kingdom: str(norm['kingdom']),
      phylum: str(norm['phylum']),
      class: str(norm['class']),
      order: str(norm['order']),
      family: str(norm['family']),
      genus: str(norm['genus']),
      species: str(norm['species']),
      scientificname: str(norm['scientificname']),
      taxonrank: str(norm['taxonrank']),
    };
  }

  get canSubmit(): boolean {
    return this.nombreColeccion.trim().length > 0 && this.parsedRows.length > 0 && this.validationErrors.length === 0;
  }

  submit(): void {
    if (!this.canSubmit) return;

    this.submitting = true;
    this.successMessage = null;
    this.errorMessage = null;

    this.misDatos.upload({ nombre_coleccion: this.nombreColeccion.trim(), json_data: this.parsedRows }).subscribe({
      next: () => {
        this.submitting = false;
        this.successMessage = `Colección "${this.nombreColeccion}" cargada correctamente (${this.parsedRows.length} registros).`;
        this.nombreColeccion = '';
        this.fileName = null;
        this.parsedRows = [];
        this.loadCollections();
      },
      error: () => {
        this.submitting = false;
        this.errorMessage = 'No se pudo cargar la colección. Verifica los datos e intenta de nuevo.';
      },
    });
  }

  remove(row: DataCollectionRow): void {
    this.misDatos.remove(row.id).subscribe({
      next: () => {
        this.collections = this.collections.filter((c) => c.id !== row.id);
      },
      error: () => {
        this.errorMessage = 'No se pudo eliminar la colección.';
      },
    });
  }
}
