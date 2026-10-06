/** "1, 2,3" -> ['1', '2', '3']; empty or missing gives []. */
export const parseIdList = (raw: string | undefined): string[] =>
    (raw ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
