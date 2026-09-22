import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withRouterConfig } from '@angular/router';
import { provideHttpClient } from '@angular/common/http'; 
import { API_BASE_URL } from 'taxon-shared';
import { environment } from '../environments/environment';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';

console.log('TOKEN API_BASE_URL:', API_BASE_URL);


export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // onSameUrlNavigation: 'reload' — necesario para "Re-ejecutar" en Historial
    // de análisis (Mi cuenta): navega a /nicho-ecologico/resultados con un
    // nuevo payload pendiente en PendingRerunService; si ya estabas en esa
    // misma URL (por un re-ejecutar anterior), el default 'ignore' de Angular
    // no vuelve a correr el guard/componente y se queda con los datos viejos.
    provideRouter(routes, withRouterConfig({ onSameUrlNavigation: 'reload' })),
    provideHttpClient(),
    provideAnimations(),
    { provide: API_BASE_URL, useValue: environment.apiBaseUrl },
  ]
};
