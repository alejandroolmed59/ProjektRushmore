import { customAlphabet } from 'nanoid'
export const GenerateId = customAlphabet(
    '1234567890abcdefghijklmnopqrstuvwxyz',
    4
)
export const GenerateLongerId = customAlphabet(
    '1234567890abcdefghijklmnopqrstuvwxyz',
    12
)
