type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type GroqResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

type GenerateGroqJsonOptions = {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxCompletionTokens?: number;
  model?: string;
};

export class GroqApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "GroqApiError";
    this.status = status;
  }
}

function getGroqApiKey() {
  const apiKey = process.env.GROQ_API_KEY?.trim();

  if (!apiKey) {
    throw new GroqApiError(
      "The AI service is not connected. Add GROQ_API_KEY to .env.local and restart the development server.",
      503,
    );
  }

  return apiKey;
}

function getGroqModel(customModel?: string) {
  return (
    customModel?.trim() ||
    process.env.GROQ_FAST_MODEL?.trim() ||
    process.env.GROQ_MODEL?.trim() ||
    "openai/gpt-oss-20b"
  );
}

function createProviderError(
  status: number,
  payload: GroqResponse,
): GroqApiError {
  const providerMessage = payload.error?.message;

  if (status === 401) {
    return new GroqApiError(
      "The Groq API key is invalid. Check GROQ_API_KEY in .env.local.",
      502,
    );
  }

  if (status === 403) {
    return new GroqApiError(
      "This Groq project cannot use the selected model. Check GROQ_FAST_MODEL or GROQ_MODEL.",
      502,
    );
  }

  if (status === 429) {
    return new GroqApiError(
      "The Groq request limit has been reached temporarily. Wait for it to reset and try again.",
      429,
    );
  }

  if (status === 400) {
    return new GroqApiError(
      providerMessage ||
        "Groq rejected the request. Check the selected model and request format.",
      502,
    );
  }

  return new GroqApiError(
    providerMessage || "Groq could not complete the AI request.",
    502,
  );
}

export async function generateGroqJson<T>({
  systemPrompt,
  userPrompt,
  temperature = 0.7,
  maxCompletionTokens = 4000,
  model,
}: GenerateGroqJsonOptions): Promise<T> {
  const apiKey = getGroqApiKey();

  const messages: GroqMessage[] = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: userPrompt,
    },
  ];

  let response: Response;

  try {
    response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: getGroqModel(model),
          temperature,
          max_completion_tokens: maxCompletionTokens,
          response_format: {
            type: "json_object",
          },
          messages,
        }),
        cache: "no-store",
      },
    );
  } catch (error) {
    console.error("Groq network request failed:", error);

    throw new GroqApiError(
      "The AI service could not be reached. Check your connection and try again.",
      502,
    );
  }

  let payload: GroqResponse;

  try {
    payload = (await response.json()) as GroqResponse;
  } catch {
    throw new GroqApiError(
      "The AI service returned an unreadable response.",
      502,
    );
  }

  if (!response.ok) {
    throw createProviderError(response.status, payload);
  }

  const outputText =
    payload.choices?.[0]?.message?.content?.trim();

  if (!outputText) {
    throw new GroqApiError(
      "The AI service returned an empty result. Please try again.",
      502,
    );
  }

  try {
    return JSON.parse(outputText) as T;
  } catch (error) {
    console.error("Groq JSON parsing failed:", error);

    throw new GroqApiError(
      "The AI service returned invalid JSON. Please generate again.",
      502,
    );
  }
}