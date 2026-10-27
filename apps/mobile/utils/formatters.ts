const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
})

const compactCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
})

const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 })

export const formatCurrency = (value: number) => currency.format(value)

export const formatCurrencyCompact = (value: number) =>
  Math.abs(value) >= 10_000 ? compactCurrency.format(value) : currency.format(value)

export const formatNumber = (value: number) => integer.format(value)

export const formatPercent = (value: number, decimals = 1) =>
  `${value.toFixed(decimals).replace(".", ",")}%`

/** Desvio relativo à mediana (0.12 → "12% acima"). */
export const formatMedianDeviation = (fraction: number) => {
  const percent = Math.round(Math.abs(fraction) * 100)
  if (percent === 0) return "na mediana"
  return fraction > 0 ? `${percent}% acima` : `${percent}% abaixo`
}

export const getInitials = (name: string) =>
  name
    .split(" ")
    .filter((word) => word.length > 2)
    .slice(0, 2)
    .map((word) => word[0]?.toLocaleUpperCase("pt-BR") ?? "")
    .join("")
