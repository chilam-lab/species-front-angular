import { Injectable } from '@angular/core';

/** Configuración del análisis en curso para adjuntar a un reporte. */
export interface IssueAnalysisContext {
  /** Paso del asistente donde estaba el usuario (target, covariables, resultados). */
  paso: string;
  /** Datos legibles (fuente, región, target, covariables, opciones); valores planos. */
  resumen: Record<string, string | number | boolean | null>;
  /** Payload del análisis tal como se enviaría (o el último ejecutado); puede estar incompleto. */
  payload: unknown;
}

/**
 * Puente entre el diálogo de reportes (en el header, a nivel raíz) y el estado
 * del análisis, que vive solo dentro del flujo de Nicho Ecológico. El flujo
 * registra una función que arma la configuración al momento de reportar.
 */
@Injectable({ providedIn: 'root' })
export class IssueContextService {
  private provider: (() => IssueAnalysisContext | null) | null = null;

  /** Registra el proveedor; devuelve la función para quitarlo. */
  register(provider: () => IssueAnalysisContext | null): () => void {
    this.provider = provider;
    return () => {
      if (this.provider === provider) this.provider = null;
    };
  }

  /** Configuración actual, o null si no hay un análisis abierto. */
  snapshot(): IssueAnalysisContext | null {
    try {
      return this.provider ? this.provider() : null;
    } catch {
      return null;
    }
  }
}
