import { GoogleGenAI } from "@google/genai";

if (!process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
  console.warn("[AI Client] WARNING: AI_INTEGRATIONS_GEMINI_API_KEY is not set");
}
if (!process.env.GEMINI_DIRECT_API_KEY) {
  console.warn("[AI Client] WARNING: GEMINI_DIRECT_API_KEY is not set — Files API uploads will fail");
}

// Proxied client — routes through Replit's managed Gemini integration.
// Supports generateContent but NOT the Files API upload endpoint.
export const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

// Direct client — bypasses the Replit proxy and talks straight to Google.
// Used for the full DQE transcription pipeline: Files API upload, poll, AND
// generateContent. All three steps must use the same Google project so that
// generateContent can access the file uploaded by files.upload() — cross-project
// file access is denied (403). The proxied `ai` client is kept for other uses.
export const directAi = new GoogleGenAI({
  apiKey: process.env.GEMINI_DIRECT_API_KEY,
});
