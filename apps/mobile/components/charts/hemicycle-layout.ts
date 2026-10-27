/**
 * Distribui assentos num semicírculo (hemiciclo de parlamento). Só geometria:
 * quem chama decide a cor de cada assento. Os assentos saem ordenados da
 * esquerda para a direita, então grupos atribuídos em sequência formam fatias
 * angulares contíguas — o desenho clássico de bancadas.
 */

export type HemicycleSeat = { x: number; y: number }

export type HemicycleLayout = {
  seats: HemicycleSeat[]
  seatRadius: number
  height: number
}

const EMPTY_LAYOUT: HemicycleLayout = { seats: [], seatRadius: 0, height: 0 }

/** Fração do raio externo onde começa a fileira mais interna. */
const INNER_RADIUS_RATIO = 0.45
/** Raio do assento em relação ao vão entre fileiras. */
const SEAT_RADIUS_RATIO = 0.42
/** Espaço mínimo entre centros na mesma fileira, em raios de assento. */
const ARC_SPACING = 2.15
/** Folga nas bordas do canvas. */
const MARGIN = 4

const MAX_ROWS = 30

type Row = { radius: number; capacity: number }

const buildRows = (count: number, outerRadius: number) => {
  const innerRadius = outerRadius * INNER_RADIUS_RATIO
  const gap = (outerRadius - innerRadius) / count
  const seatRadius = gap * SEAT_RADIUS_RATIO
  const rows: Row[] = Array.from({ length: count }, (_, i) => {
    const radius = innerRadius + (i + 0.5) * gap
    return {
      radius,
      capacity: Math.max(
        1,
        Math.floor((Math.PI * radius) / (ARC_SPACING * seatRadius)),
      ),
    }
  })
  return { rows, seatRadius }
}

const totalCapacity = (rows: Row[]) =>
  rows.reduce((sum, row) => sum + row.capacity, 0)

/** Reparte `total` entre as fileiras proporcionalmente à capacidade de cada uma. */
const distribute = (total: number, rows: Row[]): number[] => {
  const capacity = totalCapacity(rows)
  const quotas = rows.map((row) => (total * row.capacity) / capacity)
  const perRow = quotas.map((quota, i) =>
    Math.min(Math.floor(quota), rows[i]!.capacity),
  )

  let remaining = total - perRow.reduce((sum, n) => sum + n, 0)
  const byRemainder = quotas
    .map((quota, i) => ({ remainder: quota - Math.floor(quota), i }))
    .sort((a, b) => b.remainder - a.remainder)
    .map(({ i }) => i)

  // Primeiro pelos maiores restos, depois qualquer fileira com folga.
  for (const i of [...byRemainder, ...rows.keys()]) {
    if (remaining === 0) break
    const slack = rows[i]!.capacity - perRow[i]!
    const extra = Math.min(slack, remaining)
    perRow[i] = perRow[i]! + extra
    remaining -= extra
  }
  return perRow
}

export const buildHemicycle = (
  total: number,
  width: number,
): HemicycleLayout => {
  if (total <= 0 || width <= 0) return EMPTY_LAYOUT

  const outerRadius = width / 2 - MARGIN
  if (outerRadius <= 0) return EMPTY_LAYOUT

  let rowCount = 1
  let { rows, seatRadius } = buildRows(rowCount, outerRadius)
  while (totalCapacity(rows) < total && rowCount < MAX_ROWS) {
    rowCount += 1
    ;({ rows, seatRadius } = buildRows(rowCount, outerRadius))
  }

  const perRow = distribute(total, rows)
  const centerX = width / 2
  const centerY = outerRadius + MARGIN

  const placed = rows.flatMap((row, rowIndex) => {
    const count = perRow[rowIndex]!
    return Array.from({ length: count }, (_, i) => {
      const fraction = count === 1 ? 0.5 : i / (count - 1)
      const angle = Math.PI * (1 - fraction)
      return {
        x: centerX + row.radius * Math.cos(angle),
        y: centerY - row.radius * Math.sin(angle),
        angle,
        rowIndex,
      }
    })
  })

  placed.sort((a, b) => b.angle - a.angle || a.rowIndex - b.rowIndex)

  return {
    seats: placed.map(({ x, y }) => ({ x, y })),
    seatRadius,
    height: centerY + seatRadius + MARGIN,
  }
}
