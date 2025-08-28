export interface Gambler {
    discordId: string
    displayName: string
    money: number //ccc
    moneyReserved: number
}

export interface Forecast {
    gambleId: string
    descripcion: string
    createdBy: string
    yesOdds: number
    amount: number
    status: 'ACTIVE' | 'DONE'
}
export interface PredictionHistory {
    discordId: string
    predictionId: string
    gambleId: string
    gambleDecision: 'yes' | 'no'
    multiplier: number
    amountWagered: number
}

export type GamblerResult = {
    discordId: string
    profile: Gambler
    totalWon: number
    totalLost: number
    totalWageredForForecast: number
}
