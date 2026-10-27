import { format, formatDistanceToNowStrict, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

const toDate = (value: string | Date) =>
  typeof value === "string" ? parseISO(value) : value

export const formatDate = (value: string | Date) =>
  format(toDate(value), "dd/MM/yyyy", { locale: ptBR })

export const formatDateLong = (value: string | Date) =>
  format(toDate(value), "d 'de' MMMM 'de' yyyy", { locale: ptBR })

export const formatDateShort = (value: string | Date) =>
  format(toDate(value), "d 'de' MMM", { locale: ptBR })

/** Só o mês abreviado ("jan") — o ano entra para montar a data. */
export const formatMonthShort = (year: number, month: number) =>
  format(new Date(year, month - 1, 1), "MMM", { locale: ptBR })

export const formatMonthYearLong = (year: number, month: number) =>
  format(new Date(year, month - 1, 1), "MMMM 'de' yyyy", { locale: ptBR })

export const formatRelativeTime = (value: string | Date) =>
  formatDistanceToNowStrict(toDate(value), { locale: ptBR, addSuffix: true })

/** "ter, 18 de ago às 14:30" — para eventos futuros da agenda. */
export const formatDateTime = (value: string | Date) => {
  const date = toDate(value)
  const day = format(date, "EEE, d 'de' MMM", { locale: ptBR })
  const time = format(date, "HH:mm")
  return time !== "00:00" ? `${day} às ${time}` : day
}
