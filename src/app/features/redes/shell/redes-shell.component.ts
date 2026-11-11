import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { I18nService, NichoStepDef, NichoStepperComponent, TranslatePipe } from 'taxon-shared';
import { NetAnalysisStateService } from '../state/net-analysis-state.service';
import { IssueContextService } from '../../../core/issues/issue-context.service';

const STEP_PATHS = ['fuente', 'destino', 'resultados'];

// Claves de traducción (APP_I18N).
const STEP_META: { label: string; title: string; description: string }[] = [
  { label: 'red.step.fuente', title: 'red.step.fuente.title', description: 'red.step.fuente.desc' },
  { label: 'red.step.destino', title: 'red.step.destino.title', description: 'red.step.destino.desc' },
  { label: 'step.results', title: 'red.step.resultados.title', description: 'red.step.resultados.desc' },
];

/** Asistente de Redes de inferencia; mismo encabezado de pasos que Nicho Ecológico. */
@Component({
  selector: 'app-redes-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NichoStepperComponent, TranslatePipe],
  templateUrl: '../../nicho-ecologico/shell/nicho-shell.component.html',
  styleUrls: ['../../nicho-ecologico/shell/nicho-shell.component.scss'],
})
export class RedesShellComponent implements OnInit, OnDestroy {
  activeIndex = 0;
  private sub?: Subscription;
  private unregisterIssueContext?: () => void;

  private readonly i18n = inject(I18nService);
  private readonly issueContext = inject(IssueContextService);
  private readonly router = inject(Router);
  private readonly state = inject(NetAnalysisStateService);

  ngOnInit(): void {
    this.updateActiveIndex(this.router.url);
    this.sub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.updateActiveIndex(e.urlAfterRedirects));
    // "Reportar un problema" adjunta la configuración de esta red.
    this.unregisterIssueContext = this.issueContext.register(() => this.state.issueSnapshot(STEP_PATHS[this.activeIndex]));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.unregisterIssueContext?.();
  }

  private updateActiveIndex(url: string): void {
    const idx = STEP_PATHS.findIndex(p => url.includes(`/${p}`));
    this.activeIndex = idx >= 0 ? idx : 0;
  }

  get steps(): NichoStepDef[] {
    return STEP_META.map((m, i) => ({
      label: this.i18n.t(m.label),
      state: i === this.activeIndex ? 'current' : i < this.activeIndex ? 'done' : 'upcoming',
    }));
  }

  get currentStepMeta(): { title: string; description: string } {
    return STEP_META[this.activeIndex] ?? STEP_META[0];
  }

  onStepClick(index: number): void {
    if (index === this.activeIndex) return;
    if (index >= 1 && !this.state.canGoToDestino()) return;
    if (index === 2 && !this.state.canRun()) return;
    this.router.navigate(['/redes', STEP_PATHS[index]]);
  }
}
