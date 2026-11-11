import { Routes } from '@angular/router';
import { RedesShellComponent } from './shell/redes-shell.component';
import { GrupoStepComponent } from './grupo-step/grupo-step.component';
import { RedesResultadosStepComponent } from './resultados-step/redes-resultados-step.component';
import { redesStepGuard } from './guards/redes-step.guard';
import { NetAnalysisStateService } from './state/net-analysis-state.service';

export const redesRoutes: Routes = [
  {
    path: '',
    component: RedesShellComponent,
    // En la ruta (no en el @Component) para que el guard lo vea, igual que en Nicho.
    providers: [NetAnalysisStateService],
    children: [
      { path: '', redirectTo: 'fuente', pathMatch: 'full' },
      // Fuente y Destino son el mismo componente: misma selección, distinto grupo.
      { path: 'fuente', component: GrupoStepComponent, data: { grupo: 'fuente' } },
      { path: 'destino', component: GrupoStepComponent, data: { grupo: 'destino' }, canActivate: [redesStepGuard] },
      { path: 'resultados', component: RedesResultadosStepComponent, canActivate: [redesStepGuard] },
    ],
  },
];

export default redesRoutes;
