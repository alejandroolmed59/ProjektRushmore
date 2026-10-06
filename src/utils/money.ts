/** "3.5", "3.50", "$3.50" -> 350. Returns null for anything not a positive amount. */
export const parseAmountToCents = (raw: string): number | null => {
    const match = raw
        .trim()
        .replace(/^\$/, '')
        .match(/^(\d+)(?:\.(\d{1,2}))?$/)
    if (!match) return null
    const cents =
        Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
    return cents > 0 ? cents : null
}

export const formatCents = (cents: number): string =>
    `$${(cents / 100).toFixed(2)}`

/** Cool Club Coins in cents -> "1234.50". */
export const formatCcc = (cents: number): string => (cents / 100).toFixed(2)
