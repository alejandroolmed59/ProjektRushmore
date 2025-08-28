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
export interface DecisionHistory {
    discordId: string
    gambleId: string
    gambleDecision: 'yes' | 'no'
    multiplier: number
    amountWagered: number
}
