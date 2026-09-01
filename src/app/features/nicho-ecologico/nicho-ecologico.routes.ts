import { Routes } from '@angular/router';
import { NichoShellComponent } from './shell/nicho-shell.component';
import { TargetStepComponent } from './target-step/target-step.component';
import { CovariablesStepComponent } from './covariables-step/covariables-step.component';
import { ResultadosStepComponent } from './resultados-step/resultados-step.component';
import { targetMapGeneratedGuard } from './guards/target-map-generated.guard';
import { NicheAnalysisStateService } from './state/nicho-analysis-state.service';

export const nichoEcologicoRoutes: Routes = [
  {
    path: '',
    component: NichoShellComponent,
    // Provisto a nivel de RUTA (no del @Component) a propósito: los guards
    // (canActivate) se resuelven en el injector de ambiente del Router, que no
    // ve providers declarados en un @Component — solo los de Route.providers.
    providers: [NicheAnalysisStateService],
    children: [
      { path: '', redirectTo: 'target', pathMatch: 'full' },
      { path: 'target', component: TargetStepComponent },
      { path: 'covariables', component: CovariablesStepComponent, canActivate: [targetMapGeneratedGuard] },
      { path: 'resultados', component: ResultadosStepComponent, canActivate: [targetMapGeneratedGuard] }
    ]
  }
];

export default nichoEcologicoRoutes;
