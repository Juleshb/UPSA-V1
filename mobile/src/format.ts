export function money(value: number, currency = 'RWF') {
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export function statusLabel(value: string) {
  return value.replaceAll('_', ' ').toLowerCase()
}

export function shortDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function channelLabel(channel: string) {
  switch (channel) {
    case 'MOBILE_PAYMENT':
      return 'Mobile money'
    case 'BANK':
      return 'Bank'
    case 'CARD':
      return 'Card'
    case 'PSP':
      return 'Payment service'
    default:
      return 'Other rail'
  }
}

export function infrastructureLabel(value: string | null | undefined) {
  if (value === 'RSWITCH') return 'RSwitch'
  if (value === 'TIPS') return 'TIPS'
  if (value === 'NATIONAL') return 'National'
  return value ?? ''
}

export function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || fullName
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('')
}
