/**
 * Criterios normativos y clasificación de presiones según la Resolución 0330 de 2017
 * (modificada por la Resolución 0799 de 2021) del Ministerio de Vivienda, Colombia.
 * Artículos 61 (Presión mínima dinámica) y 62 (Presión máxima estática).
 */

export const CRITERIOS_RAS = {
  p_din_min: 10.0,    // m.c.a.
  p_din_tol10: 8.0,   // hasta 10% de nodos entre 8 y 10 m.c.a.
  p_din_tol5: 5.0,    // hasta 5% de nodos entre 5 y 8 m.c.a.
  p_est_max: 50.0,    // m.c.a.
  p_est_tol10: 55.0,  // hasta 10% de nodos entre 50 y 55 m.c.a.
  p_est_tol5: 60.0,   // hasta 5% de nodos entre 55 y 60 m.c.a.
  fuente: 'Res. 0330/2017 mod. Res. 0799/2021 (Arts. 61 y 62)',
}

export const CLASES_NORMATIVAS = {
  cumple: {
    label: 'Cumple Norma RAS',
    color: '#22c55e',       // Verde esmeralda
    badgeClass: 'badge-success',
    desc: 'Presión óptima (10 a 50 m.c.a.)',
  },
  tolerancia_10: {
    label: 'Tolerancia (10%)',
    color: '#eab308',       // Amarillo
    badgeClass: 'badge-warning',
    desc: 'Dentro de tolerancia admisible (8–10 ó 50–55 m.c.a.)',
  },
  tolerancia_5: {
    label: 'Tolerancia (5%)',
    color: '#f97316',       // Naranja
    badgeClass: 'badge-warning',
    desc: 'Tolerancia límite (5–8 ó 55–60 m.c.a.)',
  },
  incumple: {
    label: 'Incumple Norma',
    color: '#ef4444',       // Rojo
    badgeClass: 'badge-danger',
    desc: 'Fuera de norma (<5 m.c.a. déficit ó >60 m.c.a. sobrepresión)',
  },
  negativa: {
    label: 'Sin Servicio (Presión Negativa)',
    color: '#7f1d1d',       // Rojo vino tinto
    badgeClass: 'badge-danger',
    desc: 'Presión < 0 m.c.a. (cavitación o desabastecimiento)',
  },
}

/**
 * Clasifica un nodo según su presión dinámica (y estática opcional)
 */
export function clasificarPresionNodo(pDin, pEst = null, criterios = CRITERIOS_RAS) {
  if (pDin === undefined || pDin === null) return 'cumple'
  const p = Number(pDin)
  
  if (p < 0) return 'negativa'
  if (p < criterios.p_din_tol5) return 'incumple'
  if (p < criterios.p_din_tol10) return 'tolerancia_5'
  if (p < criterios.p_din_min) return 'tolerancia_10'

  // Si se suministra presión estática, evaluar sobrepresión
  const pE = pEst !== null ? Number(pEst) : p
  if (pE > criterios.p_est_tol5) return 'incumple'
  if (pE > criterios.p_est_tol10) return 'tolerancia_5'
  if (pE > criterios.p_est_max) return 'tolerancia_10'

  return 'cumple'
}

/**
 * Retorna el color correspondiente a la presión evaluada
 */
export function getPresionColor(pDin, pEst = null) {
  const clase = clasificarPresionNodo(pDin, pEst)
  return CLASES_NORMATIVAS[clase]?.color || '#94a3b8'
}

/**
 * Formatea presiones a números enteros coherentes con el error de calibración (RMSE) (H-15)
 */
export function fmtPresion(p) {
  if (p === undefined || p === null) return '—'
  return `${Math.round(Number(p))} m.c.a.`
}
