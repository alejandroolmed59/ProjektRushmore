import { getClient } from '../components/geminiClient'

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-flash-latest'

/**
 * Ask Gemini whether a Discord message is about work, getting to work,
 * or fatigue related to work. Fails open: any error returns false so the bot
 * does not react unless we are confident enough.
 */
export const geminiIsWorkRelated = async (
    content: string
): Promise<boolean> => {
    try {
        const prompt = `El siguiente mensaje de Discord está escrito en español (puede mezclar inglés). ¿Habla de trabajo, de ponerse a trabajar, de ir a trabajar, de estar trabajando, de jugar videojuegos en horario normal o de cansancio/agotamiento relacionado con el trabajo? Responde ÚNICAMENTE con la palabra SI o NO.\n\nMensaje: """${content}"""`

        const response = await getClient().models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
        })

        const answer = (response.text ?? '').trim().toLowerCase()
        return (
            answer.startsWith('si') ||
            answer.startsWith('sí') ||
            answer.startsWith('yes')
        )
    } catch (e) {
        console.log('[work-detector] Gemini error, failing open:', e)
        return false
    }
}
