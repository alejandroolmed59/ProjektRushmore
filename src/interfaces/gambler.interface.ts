export interface Gambler {
    discordId: string
    displayName: string
    money: number //ccc
}

export interface Forecast {
    gambleId: string
    createdBy: string
    yesOdds: number
}
