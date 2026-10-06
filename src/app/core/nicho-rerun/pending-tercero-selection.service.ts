import { Injectable } from '@angular/core';

export interface TerceroRef {
  id_data: number;
  nombre_datos: string;
}

/** Selección combinada hecha en "Mis datos": una colección como target
 *  (opcional, una sola) y cero o más colecciones como covariables — se manda
 *  de una sola vez con el botón "Usar mi selección", para que elegir varias
 *  colecciones (una target, otra(s) covariable) no se pierda entre navegaciones. */
export interface PendingTerceroSelection {
  target: TerceroRef | null;
  covariables: TerceroRef[];
}

/**
 * Puente entre "Mi cuenta > Mis datos" (fuera del árbol de rutas de
 * nicho-ecologico) y el wizard de nicho-ecologico, igual en espíritu a
 * PendingRerunService: NicheAnalysisStateService se recrea cada vez que se
 * entra a /nicho-ecologico, así que la elección de "usar estas colecciones
 * como target/covariables" no puede inyectarse directo desde /perfil/mis-datos.
 * TargetStepComponent consume esto una sola vez en su ngOnInit.
 */
@Injectable({ providedIn: 'root' })
export class PendingTerceroSelectionService {
  private pending: PendingTerceroSelection | null = null;

  set(selection: PendingTerceroSelection): void {
    this.pending = selection;
  }

  /** Lee y limpia lo pendiente (consumo de un solo uso). */
  consume(): PendingTerceroSelection | null {
    const pending = this.pending;
    this.pending = null;
    return pending;
  }
}
