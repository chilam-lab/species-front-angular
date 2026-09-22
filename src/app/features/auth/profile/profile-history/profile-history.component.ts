import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AnalysisHistoryService } from '../../../../core/analysis-history/analysis-history.service';
import { AnalysisHistoryRow } from '../../../../core/analysis-history/analysis-history.models';
import { PendingRerunService } from '../../../../core/nicho-rerun/pending-rerun.service';
import { SOURCE_LABELS } from '../../../nicho-ecologico/state/nicho-analysis.models';

@Component({
  selector: 'app-profile-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-history.component.html',
  styleUrls: ['./profile-history.component.scss']
})
export class ProfileHistoryComponent implements OnInit {
  rows: AnalysisHistoryRow[] = [];
  loading = true;
  errorMessage: string | null = null;

  constructor(
    private history: AnalysisHistoryService,
    private pendingRerun: PendingRerunService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = null;

    this.history.list().subscribe({
      next: (rows) => {
        this.rows = rows;
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'No se pudo cargar el historial de análisis.';
        this.loading = false;
      },
    });
  }

  /** Fuente / región / resolución legibles, capturadas al momento de ejecutar
   *  (columna meta). Filas guardadas antes de que existiera meta muestran '—'
   *  en región/resolución, pero igual resuelven la fuente desde el payload. */
  contextSummary(row: AnalysisHistoryRow): string {
    const fuente = row.meta?.targetSourceLabel ?? this.fallbackTargetLabel(row);
    const region = row.meta?.region ?? '—';
    const resolucion = row.meta?.resolution ?? '—';
    return `${fuente} · ${region} · ${resolucion}`;
  }

  private fallbackTargetLabel(row: AnalysisHistoryRow): string {
    const id = row.payload?.target?.[0]?.id_source;
    return id != null ? (SOURCE_LABELS[id] ?? `Fuente #${id}`) : '—';
  }

  /** Qué taxón/grupo se seleccionó como target, ej. "clase = Mammalia"
   *  (la fuente ya se muestra en contextSummary, no se repite aquí). */
  targetSummary(row: AnalysisHistoryRow): string {
    return row.payload?.target?.[0]?.q || 'Sin selección';
  }

  covarsSummary(row: AnalysisHistoryRow): string {
    const covars = row.payload?.covars ?? [];
    if (covars.length === 0) return '—';
    return covars
      .map((c) => {
        const label = SOURCE_LABELS[c.id_source] ?? `Fuente #${c.id_source}`;
        return c.q ? `${label}: ${c.q}` : label;
      })
      .join(' · ');
  }

  /** Manda al wizard de nicho-ecológico directo a Resultados con la config
   *  lista: targetMapGeneratedGuard consume el payload pendiente y solo falta
   *  dar clic en "Ejecutar Análisis" ahí. */
  rerun(row: AnalysisHistoryRow): void {
    this.pendingRerun.set(row.payload, row.meta);
    this.router.navigateByUrl('/nicho-ecologico/resultados');
  }

  remove(row: AnalysisHistoryRow): void {
    this.history.remove(row.id).subscribe({
      next: () => {
        this.rows = this.rows.filter((r) => r.id !== row.id);
      },
      error: () => {
        this.errorMessage = 'No se pudo eliminar el registro.';
      },
    });
  }
}
