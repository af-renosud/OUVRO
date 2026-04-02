import { GoogleGenAI } from "@google/genai";

if (!process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
  console.warn("[AI Client] WARNING: AI_INTEGRATIONS_GEMINI_API_KEY is not set");
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
// Used exclusively for Files API operations (upload + poll) which the proxy
// does not forward. generateContent calls must still use the proxied `ai`.
export const directAi = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
});
