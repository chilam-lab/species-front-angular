import { CovariableSource, RelationQuery, SplistItem, TaxonSelectionPayload } from './nicho-analysis.models';

/**
 * Conversión de las selecciones del taxon-navigator a consultas (RelationQuery)
 * de middleware_datasources. Funciones puras: las usan Nicho Ecológico
 * (NicheAnalysisStateService) y Redes de inferencia.
 */

/** Pares nivel/valor de una selección del navegador ("genero" → "Aedes"). */
export function buildSplistFrom(payload: TaxonSelectionPayload): SplistItem[] {
  const out: SplistItem[] = [];
  const levels = Array.isArray(payload?.levels) ? payload.levels : [];
  for (const lvl of levels) {
    const nivelRaw = (lvl?.level ?? '').toString().trim();
    const nivel = nivelRaw ? nivelRaw.toLowerCase() : '';
    if (!nivel) continue;

    const rawList =
      (Array.isArray((lvl as any).values) && (lvl as any).values) ||
      (Array.isArray((lvl as any).selected) && (lvl as any).selected) ||
      (Array.isArray((lvl as any).items) && (lvl as any).items) ||
      (typeof (lvl as any).value !== 'undefined' ? [(lvl as any).value] : []);

    for (const it of rawList) {
      let valor = '';
      if (typeof it === 'string' || typeof it === 'number') {
        valor = String(it).trim();
      } else if (it && typeof it === 'object') {
        valor = String((it as any).value ?? (it as any).name ?? (it as any).label ?? '').trim();
      }
      if (valor) out.push({ nivel, valor });
    }
  }
  return out;
}

/** "nivel = v1, v2; otro = w1" a partir de los pares nivel/valor. */
export function buildQFromSplist(items: SplistItem[]): string {
  const byNivel = new Map<string, string[]>();
  for (const it of items || []) {
    const nivel = String(it?.nivel ?? '').trim();
    const valor = String(it?.valor ?? '').trim();
    if (!nivel || !valor) continue;
    const arr = byNivel.get(nivel) ?? [];
    arr.push(valor);
    byNivel.set(nivel, arr);
  }
  const parts: string[] = [];
  byNivel.forEach((vals, nivel) => {
    const uniq = Array.from(new Set(vals));
    parts.push(`${nivel} = ${uniq.join(', ')}`);
  });
  return parts.join('; ');
}

export function buildRelationQuery(q: string, id_source: number): RelationQuery {
  return { id_source, q, offset: 0, limit: 100000 };
}

/**
 * Una consulta por fuente del navegador. Las fuentes de capas (WorldClim, DEM,
 * uso de suelo) llevan su contexto (idfuente/layer) del nodo de arranque; las
 * taxonómicas, los niveles elegidos.
 */
export function sourcesToRelationQueries(sources: CovariableSource[]): RelationQuery[] {
  return sources
    .map(src => {
      const parts: string[] = [];
      if (src.context?.idfuente != null) parts.push(`idfuente = ${src.context.idfuente}`);
      if (src.context?.layer) parts.push(`layer = ${src.context.layer}`);

      if (parts.length === 0) {
        const splist = buildSplistFrom({ levels: src.levels });
        if (splist.length === 0) return null;
        const qBase = buildQFromSplist(splist);
        if (!qBase) return null;
        parts.push(qBase);
      }

      return buildRelationQuery(parts.join('; '), src.source_id);
    })
    .filter((item): item is RelationQuery => item !== null);
}
