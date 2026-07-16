export const CURRENCIES = [
  { code: 'ZAR', locale: 'en-ZA', label: 'ZAR — South African Rand (R)' },
  { code: 'USD', locale: 'en-US', label: 'USD — US Dollar ($)' },
  { code: 'EUR', locale: 'de-DE', label: 'EUR — Euro (€)' },
  { code: 'GBP', locale: 'en-GB', label: 'GBP — British Pound (£)' },
  { code: 'AUD', locale: 'en-AU', label: 'AUD — Australian Dollar ($)' },
  { code: 'CAD', locale: 'en-CA', label: 'CAD — Canadian Dollar ($)' },
  { code: 'NGN', locale: 'en-NG', label: 'NGN — Nigerian Naira (₦)' },
  { code: 'INR', locale: 'en-IN', label: 'INR — Indian Rupee (₹)' },
  { code: 'PKR', locale: 'ur-PK', label: 'PKR — Pakistani Rupee (₨)' },
]

export function formatMoney(n, currencyCode = 'ZAR') {
  const cfg = CURRENCIES.find((c) => c.code === currencyCode) || CURRENCIES[0]
  return new Intl.NumberFormat(cfg.locale, {
    style: 'currency',
    currency: cfg.code,
    minimumFractionDigits: 2,
  }).format(n || 0)
}
