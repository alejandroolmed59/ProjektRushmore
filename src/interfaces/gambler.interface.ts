// Money fields are Cool Club Coins in integer cents.
export interface Gambler {
    discordId: string
    displayName: string
    moneyCents: number
    reservedCents: number
}

export interface Forecast {
    gambleId: string
    descripcion: string
    createdBy: string
    yesOdds: number
    amountCents: number
    status: 'ACTIVE' | 'DONE'
}
export interface PredictionHistory {
    discordId: string
    predictionId: string
    gambleId: string
    gambleDecision: 'yes' | 'no'
    multiplier: number
    amountCents: number
    status: 'ACTIVE' | 'DONE'
}

/** One gambler's settlement of an ended forecast. */
export type GamblerResult = {
    discordId: string
    profile: Gambler
    /** Paid back for winning predictions: stake times multiplier. */
    payoutCents: number
    /** Staked across all their predictions on the forecast. */
    wageredCents: number
}
