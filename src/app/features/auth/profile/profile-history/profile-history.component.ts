import { Component, OnInit, inject } from '@angular/core';
import { I18nService, TranslatePipe } from 'taxon-shared';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AnalysisHistoryService } from '../../../../core/analysis-history/analysis-history.service';
import { AnalysisHistoryRow } from '../../../../core/analysis-history/analysis-history.models';
import { PendingRerunService } from '../../../../core/nicho-rerun/pending-rerun.service';
import { SOURCE_LABELS } from '../../../nicho-ecologico/state/nicho-analysis.models';
import { describeTargetFilters } from '../../../nicho-ecologico/resultados-step/resultados-step.component';

@Component({
  selector: 'app-profile-history',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './profile-history.component.html',
  styleUrls: ['./profile-history.component.scss']
})
export class ProfileHistoryComponent implements OnInit {
  rows: AnalysisHistoryRow[] = [];
  loading = true;
  errorMessage: string | null = null;
  private readonly i18n = inject(I18nService);

  /** Fecha y hora cortas en el formato del idioma vigente. */
  fmtDate(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString(this.i18n.locale(), { dateStyle: 'short', timeStyle: 'short' });
  }

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
        this.errorMessage = this.i18n.t('hist.loadError');
        this.loading = false;
      },
    });
  }

  /** Fuente / región / resolución legibles, capturadas al momento de ejecutar
   *  (columna meta). Filas guardadas antes de que existiera meta muestran '—'
   *  en región/resolución, pero igual resuelven la fuente desde el payload. */
  contextLines(row: AnalysisHistoryRow): string[] {
    const fuente = row.meta?.targetSourceLabel ?? this.fallbackTargetLabel(row);
    const region = row.meta?.region ?? '—';
    const resolucion = row.meta?.resolution ?? '—';
    return [fuente, region, resolucion];
  }

  private fallbackTargetLabel(row: AnalysisHistoryRow): string {
    const id = row.payload?.target?.[0]?.id_source;
    return id != null ? this.sourceLabel(id) : '—';
  }

  /** Qué taxón/grupo se seleccionó como target, ej. "clase = Mammalia"
   *  (la fuente ya se muestra en contextLines, no se repite aquí). */
  targetSummary(row: AnalysisHistoryRow): string {
    return row.payload?.target?.[0]?.q || this.i18n.t('ni.none');
  }

  /** Una línea por covariable. */
  covarsLines(row: AnalysisHistoryRow): string[] {
    if (row.meta?.covars?.length) {
      return row.meta.covars.map((c) => `${c.source}: ${c.values}`);
    }
    const covars = row.payload?.covars ?? [];
    if (covars.length === 0) return ['—'];
    return covars.map((c) => {
      const label = this.sourceLabel(c.id_source);
      return c.q ? `${label}: ${c.q}` : label;
    });
  }

  /** Opciones del análisis guardadas en el payload (min_nj, a priori, mapa de
   *  probabilidad). Análisis anteriores a esas opciones no las traen. */
  optionsLines(row: AnalysisHistoryRow): string[] {
    const p = row.payload;
    const t = (k: string, prm?: Record<string, string | number>) => this.i18n.t(k, prm);
    const yn = (b: unknown) => t(b ? 'ni.yes' : 'ni.no');
    if (!p || (p.min_nj === undefined && p.apriori === undefined && p.mapa_prob === undefined && !p.target_filters)) return ['—'];
    return [
      ...(p.target_filters ? [t('hist.targetFilters', { v: describeTargetFilters(p.target_filters, this.i18n) })] : []),
      ...(p.excluded_cells?.length ? [t('hist.cellsDeleted', { n: p.excluded_cells.length })] : []),
      (p.min_nj ?? 0) > 0 ? t('ni.r.opt.minNj', { n: p.min_nj! }) : t('ni.r.opt.noMinNj'),
      t('ni.r.opt.apriori', { v: yn(p.apriori) }),
      t('hist.prob', { v: yn(p.mapa_prob) }),
      ...((p.validation_iterations ?? 0) >= 2 ? [t('ni.r.opt.validation', { n: p.validation_iterations! })] : []),
    ];
  }

  /** Manda al wizard de nicho-ecológico directo a Resultados con la config
   *  lista: targetMapGeneratedGuard consume el payload pendiente y solo falta
   *  dar clic en "Ejecutar Análisis" ahí. */
  rerun(row: AnalysisHistoryRow): void {
    this.pendingRerun.set(row.payload, row.meta);
    this.router.navigateByUrl('/nicho-ecologico/resultados');
  }

  private sourceLabel(id: number | string): string {
    if (id === 'terceros') return this.i18n.t('ni.myData');
    return SOURCE_LABELS[id] ?? this.i18n.t('ni.source', { id });
  }

  remove(row: AnalysisHistoryRow): void {
    this.history.remove(row.id).subscribe({
      next: () => {
        this.rows = this.rows.filter((r) => r.id !== row.id);
      },
      error: () => {
        this.errorMessage = this.i18n.t('hist.deleteError');
      },
    });
  }
}
