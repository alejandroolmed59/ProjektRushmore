export const calculateOdds = (yesOddInput: number) => {
    let playingOdd = yesOddInput
    if (playingOdd > 1 && playingOdd < 100) {
        playingOdd = playingOdd / 100
    }
    // The number is between 0 and 1 (exclusive)
    if (playingOdd > 0 && playingOdd <= 1) {
        //calculate percentages
        const yesOdds: number = Number(playingOdd.toFixed(2))
        const noOdds: number = Number((1 - yesOdds).toFixed(2))
        const yesMultiplier: number = Number((1 / yesOdds).toFixed(2))
        const noMultiplier: number = Number((1 / noOdds).toFixed(2))
        return {
            yesOdds, //0.2
            noOdds, //0.8
            yesMultiplier, //5
            noMultiplier, //1.25
        }
    } else throw new Error(`invalid odd ${playingOdd}`)
}
