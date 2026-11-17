import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'nicho-ecologico/target', pathMatch: 'full' },
  {
    path: 'nicho-ecologico',
    loadChildren: () => import('./features/nicho-ecologico/nicho-ecologico.routes').then(m => m.nichoEcologicoRoutes)
  },
  {
    path: 'redes',
    loadChildren: () => import('./features/redes/redes.routes').then(m => m.redesRoutes)
  },
  {
    path: '',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.authRoutes)
  }
];
