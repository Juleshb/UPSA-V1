export const DOCUMENT_TYPES = ['IDENTITY', 'BUSINESS_REGISTRATION', 'FINANCIAL_STATEMENT', 'BANK_STATEMENT', 'TAX_DOCUMENT', 'CONTRACT', 'INVOICE', 'PURCHASE_ORDER', 'COLLATERAL_DOCUMENT', 'GUARANTEE_DOCUMENT', 'OTHER']
export const COLLATERAL_TYPES = ['PROPERTY', 'VEHICLE', 'EQUIPMENT', 'DEPOSIT', 'RECEIVABLE', 'OTHER']
export const PAYMENT_METHODS = ['BANK_TRANSFER', 'MOBILE_PAYMENT', 'PSP', 'CARD', 'CASH', 'OTHER']
export const CUSTOMER_TYPES = ['SCHOOL', 'SUPPLIER', 'MEMBER', 'INVESTOR', 'PARENT']

export function today() {
  return new Date().toISOString().slice(0, 10)
}

export function num(form: FormData, name: string) {
  const value = form.get(name)
  return value == null || value === '' ? 0 : Number(value)
}

export function str(form: FormData, name: string) {
  return String(form.get(name) ?? '').trim()
}

export function checked(form: FormData, name: string) {
  return form.get(name) === 'on'
}

export function readable(value: string) {
  return value.replaceAll('_', ' ').replace(/\b[A-Za-z0-9]+\b/g, (word) => {
    if (word === word.toUpperCase() && word.length <= 3) return word
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  })
}
