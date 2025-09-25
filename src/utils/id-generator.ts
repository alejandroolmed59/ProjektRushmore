import { customAlphabet } from 'nanoid'
export const GenerateId = customAlphabet(
    '1234567890abcdefghijkmnopqrstuvwxyz',
    4
)
export const GenerateLongerId = customAlphabet(
    '1234567890abcdefghijkmnopqrstuvwxyz',
    12
)
