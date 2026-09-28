export function money(value: number, currency = 'RWF') {
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export function compactMoney(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `RF ${(value / 1_000_000).toFixed(1)}m`
  if (abs >= 1_000) return `RF ${Math.round(value / 1_000)}k`
  return money(value)
}

export function percent(value: number) {
  return `${value.toFixed(1)}%`
}

export function statusLabel(value: string) {
  return value.replaceAll('_', ' ')
}

export function shortDate(value: string) {
  return value.slice(0, 10)
}
