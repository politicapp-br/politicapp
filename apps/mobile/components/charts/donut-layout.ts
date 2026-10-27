/**
 * Geometria da rosca (gráfico de composição): só matemática pura, sem Skia.
 * Ângulos em graus a partir das 12h, sentido horário — quem desenha converte
 * para a convenção do Skia (0° às 3h) subtraindo 90.
 */

export type DonutArc = {
  /** Início do arco desenhado (metade do vão já descontada de cada lado). */
  start: number
  /** Varredura do arco desenhado (nunca negativa). */
  sweep: number
  /** Faixa angular do hit-test, sem vão: [hitStart, hitEnd). */
  hitStart: number
  hitEnd: number
}

export type DonutGeometry = {
  centerX: number
  centerY: number
  innerRadius: number
  outerRadius: number
  arcs: DonutArc[]
}

/**
 * Reparte 360° entre as fatias na proporção dos valores. O vão entre fatias
 * sai do meio de cada fronteira (não é traço por cima), então as faixas de
 * toque continuam contíguas e cobrem o círculo inteiro.
 */
export const buildDonutArcs = (
  values: number[],
  gapDegrees = 2,
): DonutArc[] => {
  const total = values.reduce((sum, value) => sum + value, 0)
  if (total <= 0) return []
  // Com uma única fatia visível não há vizinha para separar.
  const gap = values.filter((value) => value > 0).length > 1 ? gapDegrees : 0

  let accumulated = 0
  return values.map((value) => {
    const hitStart = (accumulated / total) * 360
    accumulated += value
    const hitEnd = (accumulated / total) * 360
    const sweep = Math.max(0, hitEnd - hitStart - gap)
    return {
      // Centraliza o arco na faixa de toque — vale também quando a fatia é
      // menor que o vão e a varredura foi grampeada em zero.
      start: hitStart + (hitEnd - hitStart - sweep) / 2,
      sweep,
      hitStart,
      hitEnd,
    }
  })
}

/**
 * Mapeia um toque no canvas para o índice da fatia (-1 fora do anel).
 * Worklet: o gesto chama direto na thread de UI — por isso a tolerância (px)
 * além das bordas do anel é um literal no parâmetro, e não uma constante de
 * módulo (worklets não capturam valores do escopo do módulo).
 */
export const findTappedSlice = (
  x: number,
  y: number,
  geometry: DonutGeometry,
  tolerance: number = 8,
): number => {
  "worklet"
  const dx = x - geometry.centerX
  const dy = y - geometry.centerY
  const distance = Math.hypot(dx, dy)
  if (
    distance < geometry.innerRadius - tolerance ||
    distance > geometry.outerRadius + tolerance
  ) {
    return -1
  }

  // atan2 mede a partir das 3h; +90 leva para a convenção das 12h.
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90
  const relative = ((angle % 360) + 360) % 360
  for (let index = 0; index < geometry.arcs.length; index++) {
    const arc = geometry.arcs[index]!
    if (relative >= arc.hitStart && relative < arc.hitEnd) {
      return index
    }
  }
  return -1
}
