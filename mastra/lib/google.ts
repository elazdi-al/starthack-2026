import { google } from '@ai-sdk/google';

export const decisionModel = google('gemini-3-flash-preview');
export const secretaryModel = google('gemini-3-flash-preview');
export const secretaryEmbeddingModel = google.embedding('gemini-embedding-2-preview');
