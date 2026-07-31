import { generateGroqJson } from "./groq";

export async function generateSection<T>(
  systemPrompt: string,
  userPrompt: string,
  maxCompletionTokens = 1500,
): Promise<T> {
  return generateGroqJson<T>({
    systemPrompt,
    userPrompt,
    temperature: 0.6,
    maxCompletionTokens,
  });
}