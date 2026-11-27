const COMBINING_MARKS = /[̀-ͯ]/g

/** Lowercase and strip accents, so keyword matching ignores both. */
export const normalizeText = (text: string): string =>
    text.toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '')
