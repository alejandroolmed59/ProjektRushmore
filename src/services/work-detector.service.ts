import { jevSaysYes } from '../components/typesafeClient'

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

const WORK_QUESTION =
    'This is a Discord message written in Spanish (it may mix in English). ' +
    'Is it about work: getting to work, going to work, being at work, playing ' +
    'video games during normal working hours, or tiredness/exhaustion caused ' +
    'by work?'

/**
 * Keyword pre-check first, Jev for anything ambiguous. Fails open: any error
 * returns false so the bot does not react unless we are confident enough.
 */
export const isWorkRelated = async (content: string): Promise<boolean> => {
    const verdict = keywordHasWorkRelated(content)
    if (verdict === 'yes') return true
    if (verdict === 'no') return false
    return jevSaysYes('work-detector', WORK_QUESTION, content)
}
