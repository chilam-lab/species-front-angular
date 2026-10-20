import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { I18nService, NichoStepDef, NichoStepperComponent, TranslatePipe } from 'taxon-shared';
import { NicheAnalysisStateService } from '../state/nicho-analysis-state.service';

const STEP_PATHS = ['target', 'covariables', 'resultados'];

// Claves de traducción (APP_I18N).
const STEP_META: { title: string; description: string }[] = [
  { title: 'step.target.title', description: 'step.target.desc' },
  { title: 'step.covars.title', description: 'step.covars.desc' },
  { title: 'step.results.title', description: 'step.results.desc' }
];

@Component({
  selector: 'app-nicho-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NichoStepperComponent, TranslatePipe],
  // NicheAnalysisStateService se provee en la ruta padre (nicho-ecologico.routes.ts),
  // no aquí — así el guard de ruta (canActivate) también puede inyectarlo.
  templateUrl: './nicho-shell.component.html',
  styleUrls: ['./nicho-shell.component.scss']
})
export class NichoShellComponent implements OnInit, OnDestroy {
  activeIndex = 0;
  private sub?: Subscription;

  private readonly i18n = inject(I18nService);

  constructor(private router: Router, private state: NicheAnalysisStateService) {}

  ngOnInit(): void {
    this.updateActiveIndex(this.router.url);
    this.sub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.updateActiveIndex(e.urlAfterRedirects));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private updateActiveIndex(url: string): void {
    const idx = STEP_PATHS.findIndex(p => url.includes(`/${p}`));
    this.activeIndex = idx >= 0 ? idx : 0;
  }

  get steps(): NichoStepDef[] {
    return [
      { label: this.i18n.t('step.target'), state: this.stateFor(0) },
      { label: this.i18n.t('step.covars'), state: this.stateFor(1) },
      { label: this.i18n.t('step.results'), state: this.stateFor(2) }
    ];
  }

  private stateFor(index: number): NichoStepDef['state'] {
    if (index === this.activeIndex) return 'current';
    if (index < this.activeIndex) return 'done';
    return 'upcoming';
  }

  get currentStepMeta(): { title: string; description: string } {
    return STEP_META[this.activeIndex] ?? STEP_META[0];
  }

  onStepClick(index: number): void {
    if (index === this.activeIndex) return;
    if (index > 0 && !this.state.targetMapGenerated) return; // el guard también lo cubre
    this.router.navigate(['/nicho-ecologico', STEP_PATHS[index]]);
  }
}
