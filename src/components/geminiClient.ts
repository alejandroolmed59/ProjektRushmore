import { GoogleGenAI } from '@google/genai'

let genaiClient: GoogleGenAI | null = null
export const getClient = (): GoogleGenAI => {
    if (!genaiClient) {
        genaiClient = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY ?? '',
        })
    }
    return genaiClient
}
