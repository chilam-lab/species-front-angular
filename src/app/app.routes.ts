import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'nicho-ecologico/target', pathMatch: 'full' },
  {
    path: 'nicho-ecologico',
    loadChildren: () => import('./features/nicho-ecologico/nicho-ecologico.routes').then(m => m.nichoEcologicoRoutes)
  }
];
