import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx';
import { I18nService, TranslatePipe } from 'taxon-shared';
import { MisDatosService } from '../../../../core/mis-datos/mis-datos.service';
import { DataCollectionRow, OccUploadRow } from '../../../../core/mis-datos/mis-datos.models';
import { PendingTerceroSelectionService, TerceroRef } from '../../../../core/nicho-rerun/pending-tercero-selection.service';

type UsoRole = 'ninguno' | 'target' | 'covariable';

const CHAR_FORMAT = /[`!@#$%^&*()+=\[\]{};'"\\|,<>?~]/;
const FIXED_COLUMNS = ['occurrenceid', 'decimallatitude', 'decimallongitude', 'eventdate'];

/** Columnas con significado fijo; tipo y comentario son claves de traducción. */
export const TEMPLATE_COLUMNS = [
  { name: 'occurrenceid', tipoKey: 'data.type.text', comentarioKey: 'data.c.occurrenceid' },
  { name: 'decimallatitude', tipoKey: 'data.type.decimal', comentarioKey: 'data.c.decimallatitude' },
  { name: 'decimallongitude', tipoKey: 'data.type.decimal', comentarioKey: 'data.c.decimallongitude' },
  { name: 'eventdate', tipoKey: 'data.type.text', comentarioKey: 'data.c.eventdate' },
];

function isNumeric(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  return !isNaN(value as any) && !isNaN(parseFloat(value as string));
}

function validateRows(rows: OccUploadRow[], t: (key: string, params: Record<string, number>) => string): string[] {
  const errors: string[] = [];

  rows.forEach((item, index) => {
    const line = index + 1;

    if (item.occurrenceid && CHAR_FORMAT.test(item.occurrenceid)) {
      errors.push(t('data.e.id', { line }));
    }

    const lat = parseFloat(item.decimallatitude);
    if (!isNumeric(item.decimallatitude) || lat < -90 || lat > 90) {
      errors.push(t('data.e.lat', { line }));
    }

    const lon = parseFloat(item.decimallongitude);
    if (!isNumeric(item.decimallongitude) || lon < -180 || lon > 180) {
      errors.push(t('data.e.lon', { line }));
    }
  });

  return errors;
}

@Component({
  selector: 'app-mis-datos',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './mis-datos.component.html',
  styleUrls: ['./mis-datos.component.scss']
})
export class MisDatosComponent implements OnInit {
  readonly templateColumns = TEMPLATE_COLUMNS;
  private readonly i18n = inject(I18nService);

  nombreColeccion = '';
  fileName: string | null = null;
  parsedRows: OccUploadRow[] = [];
  validationErrors: string[] = [];
  metadataColumns: string[] = [];

  collections: DataCollectionRow[] = [];
  loadingList = true;
  submitting = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;

  /** Uso elegido por colección (id → rol), editable libremente antes de
   *  confirmar con "Usar mi selección" — así una persona con varias
   *  colecciones puede marcar una como target y otra(s) como covariable en
   *  un solo paso, sin perder la elección al navegar entre filas. */
  roleSelections: Record<number, UsoRole> = {};

  constructor(
    private misDatos: MisDatosService,
    private pendingTercero: PendingTerceroSelectionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCollections();
  }

  getRole(id: number): UsoRole {
    return this.roleSelections[id] ?? 'ninguno';
  }

  /** Target es de un solo uso: al marcar una colección como target, cualquier
   *  otra que ya lo fuera vuelve a "ninguno". Covariable sí admite varias. */
  setRole(id: number, role: UsoRole): void {
    if (role === 'target') {
      for (const key of Object.keys(this.roleSelections)) {
        if (this.roleSelections[+key] === 'target') this.roleSelections[+key] = 'ninguno';
      }
    }
    this.roleSelections[id] = role;
  }

  get hasSelection(): boolean {
    return Object.values(this.roleSelections).some((r) => r !== 'ninguno');
  }

  /** Junta todo lo marcado en la tabla y manda al wizard de Nicho Ecológico
   *  de una sola vez (target-step la recoge en su ngOnInit). */
  usarMiSeleccion(): void {
    const toRef = (id: number): TerceroRef | null => {
      const row = this.collections.find((c) => c.id === id);
      return row ? { id_data: row.id, nombre_datos: row.nombre_datos } : null;
    };

    const targetId = Object.keys(this.roleSelections)
      .map(Number)
      .find((id) => this.roleSelections[id] === 'target');
    const covariableIds = Object.keys(this.roleSelections)
      .map(Number)
      .filter((id) => this.roleSelections[id] === 'covariable');

    const target = targetId != null ? toRef(targetId) : null;
    const covariables = covariableIds.map(toRef).filter((r): r is TerceroRef => r !== null);

    if (!target && covariables.length === 0) return;

    this.pendingTercero.set({ target, covariables });
    this.router.navigateByUrl('/nicho-ecologico/target');
  }

  loadCollections(): void {
    this.loadingList = true;
    this.misDatos.list().subscribe({
      next: (rows) => {
        this.collections = rows;
        for (const row of rows) {
          if (!(row.id in this.roleSelections)) this.roleSelections[row.id] = 'ninguno';
        }
        this.loadingList = false;
      },
      error: () => {
        this.errorMessage = this.i18n.t('data.listError');
        this.loadingList = false;
      },
    });
  }

  onFileSelected(event: Event): void {
    this.successMessage = null;
    this.errorMessage = null;
    this.parsedRows = [];
    this.validationErrors = [];
    this.metadataColumns = [];

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

        this.parsedRows = raw.map((row, index) => this.mapRow(row, index));
        this.metadataColumns = Array.from(new Set(this.parsedRows.flatMap((row) => Object.keys(row.metadata))));
        this.validationErrors = validateRows(this.parsedRows, (k, p) => this.i18n.t(k, p));
      } catch (err) {
        this.errorMessage = this.i18n.t('data.readError');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  downloadTemplate(): void {
    const headers = this.templateColumns.map((col) => col.name);
    const t = (k: string) => this.i18n.t(k);
    const example = {
      occurrenceid: t('data.example'),
      decimallatitude: '19.4326',
      decimallongitude: '-99.1332',
      eventdate: '01/01/2024',
    };

    const dataSheet = XLSX.utils.json_to_sheet([example], { header: headers });
    const specSheet = XLSX.utils.json_to_sheet(
      this.templateColumns.map((col) => ({
        [t('data.sheet.column')]: col.name,
        [t('data.sheet.type')]: t(col.tipoKey),
        [t('data.sheet.comment')]: t(col.comentarioKey),
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, dataSheet, t('data.sheet.template'));
    XLSX.utils.book_append_sheet(workbook, specSheet, t('data.sheet.instructions'));

    XLSX.writeFile(workbook, 'plantilla_carga_datos.xlsx');
  }

  private mapRow(row: Record<string, unknown>, index: number): OccUploadRow {
    const norm: Record<string, unknown> = {};
    for (const key of Object.keys(row)) {
      norm[key.trim().toLowerCase()] = row[key];
    }
    const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());

    const metadata: Record<string, string> = {};
    for (const key of Object.keys(norm)) {
      if (!FIXED_COLUMNS.includes(key)) {
        metadata[key] = str(norm[key]);
      }
    }

    return {
      occurrenceid: str(norm['occurrenceid']) || `auto-${index + 1}`,
      decimallatitude: str(norm['decimallatitude']),
      decimallongitude: str(norm['decimallongitude']),
      eventdate: str(norm['eventdate']),
      metadata,
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
        this.successMessage = this.i18n.t('data.uploaded', { name: this.nombreColeccion, n: this.parsedRows.length });
        this.nombreColeccion = '';
        this.fileName = null;
        this.parsedRows = [];
        this.loadCollections();
      },
      error: () => {
        this.submitting = false;
        this.errorMessage = this.i18n.t('data.uploadError');
      },
    });
  }

  /** Fecha y hora cortas en el formato del idioma vigente. */
  fmtDate(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString(this.i18n.locale(), { dateStyle: 'short', timeStyle: 'short' });
  }

  remove(row: DataCollectionRow): void {
    this.misDatos.remove(row.id).subscribe({
      next: () => {
        this.collections = this.collections.filter((c) => c.id !== row.id);
      },
      error: () => {
        this.errorMessage = this.i18n.t('data.deleteError');
      },
    });
  }
}
