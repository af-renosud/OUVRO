import { Router, type Request, type Response } from "express";
import { ai } from "../ai-client";
import { transcribeAudio } from "./ai-helpers";
import { formatServerError } from "./archidoc-helpers";

export const aiRouter = Router();

aiRouter.post("/transcribe", async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType = "audio/mp4", language } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: "Audio data is required" });
    }

    const transcription = await transcribeAudio(audioBase64, mimeType, language);
    return res.json({ transcription });
  } catch (error) {
    console.error("Error transcribing audio:", error);
    const { status, message } = formatServerError(error, "Transcribe Audio");
    return res.status(status).json({ error: message });
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
            {
              text: `Translate the following text to ${targetLanguage}. Only output the translation, nothing else:\n\n${text}`,
            },
          ],
        },
      ],
    });

    const translation = response.text || "";
    return res.json({ translation });
  } catch (error) {
    console.error("Error translating text:", error);
    const { status, message } = formatServerError(error, "Translate Text");
    return res.status(status).json({ error: message });
  }
});
