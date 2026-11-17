import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { NetAnalysisStateService } from '../state/net-analysis-state.service';
import { PendingNetRerunService } from '../../../core/redes-rerun/pending-net-rerun.service';

/** Destino requiere malla y nodos fuente; Resultados, además, nodos destino.
 *  Cubre la entrada por URL directa; la UI ya deshabilita "Siguiente".
 *
 *  También hidrata un "Re-ejecutar" de Mi cuenta > Historial: la red guardada
 *  viaja por PendingNetRerunService (root) y se carga aquí, antes de Resultados. */
export const redesStepGuard: CanActivateFn = (route) => {
  const state = inject(NetAnalysisStateService);
  const router = inject(Router);

  const pending = inject(PendingNetRerunService).consume();
  if (pending) state.loadPreloaded(pending.payload, pending.meta);

  if (!state.canGoToDestino()) return router.createUrlTree(['/redes/fuente']);
  if (route.routeConfig?.path === 'resultados' && !state.canRun()) return router.createUrlTree(['/redes/destino']);
  return true;
};
