import { getClient } from '../components/geminiClient'

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-flash-latest'

const COMBINING_MARKS = /[̀-ͯ]/g
const normalizeText = (text: string): string =>
    text.toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '')

const STRONG_WORK_KEYWORDS = [
    'trabajo',
    'trabajar',
    'trabajando',
    'trabaja',
    'trabaje',
    'trabajes',
    'trabajamos',
    'trabajas',
    'trabajan',
    'trabajaron',
    'jornada',
    'turno',
    'oficina',
    'empleo',
    'empresa',
    'jefe',
    'boss',
    'manager',
    'reunion',
    'reunión',
    'meeting',
    'deadline',
    'proyecto',
    'project',
    'cliente',
    'tarea',
    'tareas',
    'ticket',
    'jira',
    'kanban',
    'sprint',
    'horario',
    'horas',
]

const STRONG_NON_WORK_KEYWORDS = [
    'futbol',
    'gaming',
    'anime',
    'pelicula',
    'serie',
    'fiesta',
    'comida',
    'restaurante',
    'chafa',
    'tomar',
    'controlito',
    'cs2',
    'steam',
]

const AMBIGUOUS_WORK_KEYWORDS = [
    'cansado',
    'cansada',
    'agotado',
    'agotada',
    'fatiga',
    'fatigado',
    'fatigada',
    'exhausto',
    'exhausta',
    'desmotivado',
    'desmotivada',
]

const containsKeyword = (text: string, keywords: string[]): boolean =>
    keywords.some((keyword) => text.includes(keyword))

export const keywordHasWorkRelated = (
    content: string
): 'yes' | 'no' | 'maybe' => {
    const normalized = normalizeText(content)

    if (containsKeyword(normalized, STRONG_WORK_KEYWORDS)) return 'yes'
    if (containsKeyword(normalized, STRONG_NON_WORK_KEYWORDS)) return 'no'
    if (containsKeyword(normalized, AMBIGUOUS_WORK_KEYWORDS)) return 'maybe'

    return 'maybe'
}

/**
 * Ask Gemini whether a Discord message is about work, getting to work,
 * or fatigue related to work. Fails open: any error returns false so the bot
 * does not react unless we are confident enough.
 */
export const geminiIsWorkRelated = async (
    content: string
): Promise<boolean> => {
    const verdict = keywordHasWorkRelated(content)
    if (verdict === 'yes') return true
    if (verdict === 'no') return false

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
