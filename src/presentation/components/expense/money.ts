/** Cents in, a formatted amount out. Never a float in between. */
export function formatCents(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

/** Euros as typed by a person ("120,50") into cents, or null when it is not a number we accept. */
export function parseEuros(input: string): number | null {
  const normalised = input.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalised)) return null
  return Math.round(Number(normalised) * 100)
}
