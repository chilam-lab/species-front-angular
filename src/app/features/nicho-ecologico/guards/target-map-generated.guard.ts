import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { NicheAnalysisStateService } from '../state/nicho-analysis-state.service';
import { PendingRerunService } from '../../../core/nicho-rerun/pending-rerun.service';

/** Backstop de ruta: si alguien entra por URL directa a /covariables o /resultados
 *  sin haber generado el mapa target, lo regresa a /target. La UI (botón "Siguiente"
 *  deshabilitado en TargetStepComponent) es la primera línea de defensa; esto cubre
 *  el acceso directo por URL, algo que las rutas reales hacen posible.
 *
 *  También es el punto donde se hidrata un "Re-ejecutar" disparado desde
 *  Mi cuenta > Historial de análisis: NicheAnalysisStateService se recrea al
 *  entrar a /nicho-ecologico, así que el payload viaja por PendingRerunService
 *  (root) y se consume aquí, antes de que exista el componente de la ruta. */
export const targetMapGeneratedGuard: CanActivateFn = () => {
  const state = inject(NicheAnalysisStateService);
  const pendingRerun = inject(PendingRerunService);
  const router = inject(Router);

  // Un "Re-ejecutar" pendiente SIEMPRE gana, aunque state.targetMapGenerated ya
  // fuera true de una corrida anterior (con onSameUrlNavigation:'reload', este
  // guard puede volver a correr sobre el mismo NicheAnalysisStateService en vez
  // de uno recién creado — sin esta prioridad, un segundo "Re-ejecutar" se
  // ignoraba y seguía mostrando la configuración anterior).
  const pending = pendingRerun.consume();
  if (pending) {
    state.preloadedPayload = pending.payload;
    state.preloadedMeta = pending.meta;
    state.preloadedTargetEdited = false;
    state.preloadedCovarsEdited = false;
    state.gridId = pending.payload.grid_id;
    state.targetMapGenerated = true;
    // Limpia resultados de una corrida anterior (si el mismo state service se
    // reutilizó vía onSameUrlNavigation:'reload') para no mezclar mapa/tabla/
    // histogramas viejos con la nueva configuración recién cargada.
    state.uuidNiche = null;
    state.tableRows = [];
    state.scoreDeciles = [];
    state.decileHistogramData = [];
    return true;
  }

  if (state.targetMapGenerated) {
    return true;
  }

  return router.createUrlTree(['/nicho-ecologico/target']);
};
