import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'nicho-ecologico/target', pathMatch: 'full' },
  {
    path: 'nicho-ecologico',
    loadChildren: () => import('./features/nicho-ecologico/nicho-ecologico.routes').then(m => m.nichoEcologicoRoutes)
  },
  {
    // Prueba de la librería red-species (fase 2 de Redes); la reemplaza el asistente de Redes.
    path: 'redes/prueba',
    loadComponent: () => import('./features/redes/prueba/red-prueba.component').then(m => m.RedPruebaComponent)
  },
  {
    path: '',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.authRoutes)
  }
];
