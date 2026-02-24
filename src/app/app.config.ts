import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http'; 
import { API_BASE_URL } from 'taxon-shared';
import { environment } from '../environments/environment';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';

console.log('TOKEN API_BASE_URL:', API_BASE_URL);


export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    provideAnimations(),
    { provide: API_BASE_URL, useValue: environment.apiBaseUrl },
  ]
};
