import { Injectable } from '@angular/core';
import { TerceroRef } from '../nicho-rerun/pending-tercero-selection.service';

/** Colecciones propias elegidas en "Mis datos" para cada grupo de una red. */
export interface PendingNetTerceros {
  fuente: TerceroRef[];
  destino: TerceroRef[];
}

/**
 * Puente entre "Mi cuenta > Mis datos" y el asistente de Redes, como
 * PendingTerceroSelectionService para Nicho: el paso Fuente lo consume una
 * sola vez al abrirse.
 */
@Injectable({ providedIn: 'root' })
export class PendingNetTerceroService {
  private pending: PendingNetTerceros | null = null;

  set(selection: PendingNetTerceros): void {
    this.pending = selection;
  }

  consume(): PendingNetTerceros | null {
    const pending = this.pending;
    this.pending = null;
    return pending;
  }
}
