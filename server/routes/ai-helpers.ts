import { ai } from "../ai-client";

export async function transcribeAudio(audioBase64: string, mimeType = "audio/mp4"): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: "Please transcribe the following audio accurately into English text. Only output the transcription, nothing else.",
          },
          {
            inlineData: {
              mimeType,
              data: audioBase64,
            },
          },
        ],
      },
    ],
  });
  return response.text || "";
}
