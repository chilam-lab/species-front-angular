import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { NicheAnalysisStateService } from '../state/nicho-analysis-state.service';

/** Backstop de ruta: si alguien entra por URL directa a /covariables o /resultados
 *  sin haber generado el mapa target, lo regresa a /target. La UI (botón "Siguiente"
 *  deshabilitado en TargetStepComponent) es la primera línea de defensa; esto cubre
 *  el acceso directo por URL, algo que las rutas reales hacen posible. */
export const targetMapGeneratedGuard: CanActivateFn = () => {
  const state = inject(NicheAnalysisStateService);
  const router = inject(Router);

  if (state.targetMapGenerated) {
    return true;
  }
  return router.createUrlTree(['/nicho-ecologico/target']);
};
