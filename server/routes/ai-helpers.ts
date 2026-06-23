import { ai } from "../ai-client";

export async function transcribeAudio(
  audioBase64: string,
  mimeType = "audio/mp4",
  language?: string,
): Promise<string> {
  const instruction = language
    ? `Please transcribe the following audio accurately, verbatim, in ${language} (the language being spoken). Do not translate. Only output the transcription, nothing else.`
    : "Please transcribe the following audio accurately into English text. Only output the transcription, nothing else.";
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: instruction,
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
