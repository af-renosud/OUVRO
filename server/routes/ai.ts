import { Router, type Request, type Response } from "express";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export const aiRouter = Router();

aiRouter.post("/transcribe", async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType = "audio/mp4" } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: "Audio data is required" });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: "Please transcribe the following audio accurately into English text. Only output the transcription, nothing else." },
            {
              inlineData: {
                mimeType: mimeType,
                data: audioBase64,
              },
            },
          ],
        },
      ],
    });

    const transcription = response.text || "";
    res.json({ transcription });
  } catch (error: any) {
    console.error("Error transcribing audio:", error);
    const errorMessage = error?.message || "Failed to transcribe audio";
    res.status(500).json({ error: errorMessage });
  }
});

aiRouter.post("/translate", async (req: Request, res: Response) => {
  try {
    const { text, targetLanguage = "French" } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: `Translate the following text to ${targetLanguage}. Only output the translation, nothing else:\n\n${text}` },
          ],
        },
      ],
    });

    const translation = response.text || "";
    res.json({ translation });
  } catch (error) {
    console.error("Error translating text:", error);
    res.status(500).json({ error: "Failed to translate text" });
  }
});
