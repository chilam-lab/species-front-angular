import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { NetAnalysisStateService } from '../state/net-analysis-state.service';

/** Destino requiere malla y nodos fuente; Resultados, además, nodos destino.
 *  Cubre la entrada por URL directa; la UI ya deshabilita "Siguiente". */
export const redesStepGuard: CanActivateFn = (route) => {
  const state = inject(NetAnalysisStateService);
  const router = inject(Router);
  if (!state.canGoToDestino()) return router.createUrlTree(['/redes/fuente']);
  if (route.routeConfig?.path === 'resultados' && !state.canRun()) return router.createUrlTree(['/redes/destino']);
  return true;
};
