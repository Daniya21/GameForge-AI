const ALLOWED_FORMATS = [
  "Cinematic Cutscene",
  "Interactive Conversation",
  "Branching Dialogue",
  "Quest Dialogue",
  "Companion Banter",
  "Villain Confrontation",
  "Combat Banter",
] as const;

const ALLOWED_TONES = [
  "Natural",
  "Tense",
  "Emotional",
  "Dark",
  "Humorous",
  "Epic",
  "Mysterious",
] as const;

const ALLOWED_LENGTHS = [
  "Short",
  "Standard",
  "Extended",
] as const;

const ALLOWED_INTENSITIES = [
  "Subtle",
  "Moderate",
  "High Stakes",
] as const;

type DialogueRequest = {
  prompt?: unknown;
  characters?: unknown;
  format?: unknown;
  tone?: unknown;
  length?: unknown;
  intensity?: unknown;
  sceneGoal?: unknown;
  specialRequirements?: unknown;
};

type DialogueLine = {
  speaker: string;
  line: string;
  direction: string;
};

type DialogueBlueprint = {
  sceneTitle: string;
  sceneSubtitle: string;
  promptUnderstanding: string;
  sceneSetup: string;
  characterVoiceGuide: string[];
  dialogueLines: DialogueLine[];
  emotionalBeats: string[];
  branchingChoices: string[];
  subtextAndIntent: string;
  performanceDirection: string;
  continuityAndConsequences: string;
  implementationNotes: string;
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

const REQUIRED_STRING_FIELDS: Array<keyof Omit<
  DialogueBlueprint,
  "characterVoiceGuide" | "dialogueLines" | "emotionalBeats" | "branchingChoices"
>> = [
  "sceneTitle",
  "sceneSubtitle",
  "promptUnderstanding",
  "sceneSetup",
  "subtextAndIntent",
  "performanceDirection",
  "continuityAndConsequences",
  "implementationNotes",
];

const DIALOGUE_SYSTEM_PROMPT = `You are GameForge AI's senior dialogue writer, narrative designer, and cinematic scene director.

Create one polished, production-ready video-game dialogue scene that faithfully develops the user's scene prompt, cast, dialogue format, tone, intensity, length, scene goal, and special requirements.

NON-NEGOTIABLE RULES:
1. The user's prompt is the source of truth. Preserve the central situation, relationships, conflict, information, and intended outcome. Never replace it with a generic scene.
2. Correct spelling and grammar silently. Understand informal, incomplete, or simple human wording without criticizing it.
3. Give every speaking character a distinct voice based on role, personality, history, power, emotional state, and relationship. A reader should identify the speaker even without the name label.
4. Write natural spoken language. Avoid generic exposition, repetitive greetings, obvious statements, unnatural speeches, and characters explaining facts they already know.
5. Use subtext. Characters may hide, deflect, pressure, manipulate, joke, hesitate, or reveal information indirectly when appropriate.
6. Every line must serve at least one purpose: reveal character, increase tension, advance the scene, communicate actionable information, change a relationship, or create a choice.
7. Stage directions must be concise and playable. Describe delivery, meaningful action, interruption, silence, or environmental reaction—not camera essays.
8. Respect the selected format. Cinematic scenes should have controlled pacing; branching dialogue must include meaningful player choices; combat banter must be brief and reactive; companion banter must deepen relationships without blocking gameplay.
9. Player choices must be meaningfully different. Each choice must alter tone, trust, information, access, immediate action, or later consequences.
10. Do not copy dialogue, catchphrases, scenes, or characters from existing games, films, television, celebrities, or copyrighted franchises.
11. Keep the scene usable in a real game. Include voice guidance, emotional beats, consequences, and implementation notes.
12. Return ONLY one valid JSON object. Do not include markdown, code fences, commentary, or text outside the JSON.

13. Stage directions, character presentation, props, and environmental reactions must remain compatible with the locked GameForge Stylized 3D art system and pre-production design system.

Before returning, silently review the dialogue aloud in your mind. Rewrite any line that sounds generic, redundant, out of character, overly explanatory, or disconnected from the prompt. Do not reveal this review process.`;

function isAllowed<T extends readonly string[]>(value: string, allowed: T): value is T[number] {
  return allowed.includes(value as T[number]);
}

function isStringArray(value: unknown, minimum: number) {
  return (
    Array.isArray(value) &&
    value.length >= minimum &&
    value.every((item) => typeof item === "string" && item.trim().length > 0)
  );
}

function isDialogueLine(value: unknown): value is DialogueLine {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.speaker === "string" &&
    record.speaker.trim().length > 0 &&
    typeof record.line === "string" &&
    record.line.trim().length > 0 &&
    typeof record.direction === "string"
  );
}

function isDialogueBlueprint(value: unknown): value is DialogueBlueprint {
  if (!value || typeof value !== "object") return false;

  const record = value as Record<string, unknown>;

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof record[field] !== "string" || !record[field].trim()) {
      return false;
    }
  }

  return (
    isStringArray(record.characterVoiceGuide, 2) &&
    Array.isArray(record.dialogueLines) &&
    record.dialogueLines.length >= 8 &&
    record.dialogueLines.every(isDialogueLine) &&
    isStringArray(record.emotionalBeats, 3) &&
    Array.isArray(record.branchingChoices) &&
    record.branchingChoices.every(
      (item) => typeof item === "string" && item.trim().length > 0,
    )
  );
}

function parseDialogueBlueprint(content: string): DialogueBlueprint {
  const parsed = JSON.parse(content) as unknown;

  if (!isDialogueBlueprint(parsed)) {
    throw new Error("The AI returned an incomplete dialogue scene. Please generate again.");
  }

  return {
    ...parsed,
    characterVoiceGuide: parsed.characterVoiceGuide.slice(0, 8),
    dialogueLines: parsed.dialogueLines.slice(0, 40),
    emotionalBeats: parsed.emotionalBeats.slice(0, 7),
    branchingChoices: parsed.branchingChoices.slice(0, 4),
  };
}

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(request: Request) {
  let body: DialogueRequest;

  try {
    body = (await request.json()) as DialogueRequest;
  } catch {
    return Response.json({ error: "The request body must be valid JSON." }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const characters = typeof body.characters === "string" ? body.characters.trim() : "";
  const format = typeof body.format === "string" ? body.format.trim() : "";
  const tone = typeof body.tone === "string" ? body.tone.trim() : "";
  const length = typeof body.length === "string" ? body.length.trim() : "";
  const intensity = typeof body.intensity === "string" ? body.intensity.trim() : "";
  const sceneGoal = typeof body.sceneGoal === "string" ? body.sceneGoal.trim() : "";
  const specialRequirements =
    typeof body.specialRequirements === "string" ? body.specialRequirements.trim() : "";

  if (prompt.length < 14) {
    return Response.json(
      { error: "Describe the dialogue scene in at least 14 characters." },
      { status: 400 },
    );
  }

  if (prompt.length > 2400) {
    return Response.json(
      { error: "The scene prompt is too long. Keep it below 2,400 characters." },
      { status: 400 },
    );
  }

  if (characters.length < 4) {
    return Response.json(
      { error: "Add at least two characters, roles, or speaking participants." },
      { status: 400 },
    );
  }

  if (characters.length > 1400 || sceneGoal.length > 500 || specialRequirements.length > 800) {
    return Response.json(
      { error: "One of the dialogue fields is too long. Please shorten it." },
      { status: 400 },
    );
  }

  if (!isAllowed(format, ALLOWED_FORMATS)) {
    return Response.json({ error: "Please select a valid dialogue format." }, { status: 400 });
  }

  if (!isAllowed(tone, ALLOWED_TONES)) {
    return Response.json({ error: "Please select a valid tone." }, { status: 400 });
  }

  if (!isAllowed(length, ALLOWED_LENGTHS)) {
    return Response.json({ error: "Please select a valid scene length." }, { status: 400 });
  }

  if (!isAllowed(intensity, ALLOWED_INTENSITIES)) {
    return Response.json({ error: "Please select a valid dramatic intensity." }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error:
          "Dialogue Generator is not connected. Add GROQ_API_KEY to .env.local and restart the development server.",
      },
      { status: 503 },
    );
  }

  const model = process.env.GROQ_FAST_MODEL?.trim() || process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-20b";

  const lineTarget =
    length === "Short"
      ? "10 to 14 dialogue lines"
      : length === "Extended"
        ? "24 to 36 dialogue lines"
        : "16 to 24 dialogue lines";

  const branchRequirement =
    format === "Branching Dialogue" || format === "Interactive Conversation"
      ? "Create 3 to 4 meaningful player choices, each including the immediate response and consequence."
      : "Return an empty branchingChoices array unless player choices genuinely improve this format.";

  const requestedShape = {
    sceneTitle: "string",
    sceneSubtitle: "string",
    promptUnderstanding: "string",
    sceneSetup: "string",
    characterVoiceGuide: ["2 to 8 character voice guide strings"],
    dialogueLines: [
      {
        speaker: "character name",
        line: "spoken dialogue only",
        direction: "concise performance or action direction; may be empty",
      },
    ],
    emotionalBeats: ["3 to 7 ordered emotional beat strings"],
    branchingChoices: ["0 to 4 choice strings containing response and consequence"],
    subtextAndIntent: "string",
    performanceDirection: "string",
    continuityAndConsequences: "string",
    implementationNotes: "string",
  };

  try {
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.72,
        max_completion_tokens: 3800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: DIALOGUE_SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify(
              {
                task: "Write a complete, natural, production-ready video-game dialogue scene.",
                scenePrompt: prompt,
                charactersOrCast: characters,
                dialogueFormat: format,
                tone,
                sceneLength: length,
                dramaticIntensity: intensity,
                sceneGoal:
                  sceneGoal || "Infer the clearest dramatic and gameplay purpose from the prompt.",
                specialRequirements:
                  specialRequirements || "No extra restrictions. Prioritize distinct voices, subtext, and scene progression.",
                dialogueLineTarget: lineTarget,
                branchingRequirement: branchRequirement,
                requiredJsonShape: requestedShape,
                requirements: {
                  alignment:
                    "The scene must directly dramatize the user's prompt and preserve its characters, conflict, and intent.",
                  characterVoices:
                    "Each speaker needs distinct vocabulary, rhythm, confidence, emotional defenses, and conversational tactics.",
                  naturalism:
                    "Avoid generic exposition. Use interruptions, pauses, reactions, pressure, and subtext where appropriate.",
                  gameReadiness:
                    "Make the scene easy to implement, perform, and connect to player actions or later consequences.",
                },
              },
              null,
              2,
            ),
          },
        ],
      }),
    });

    const payload = (await groqResponse.json()) as GroqResponse;

    if (!groqResponse.ok) {
      const providerMessage = payload.error?.message;
      const safeMessage =
        groqResponse.status === 401
          ? "The Groq API key is invalid. Check GROQ_API_KEY in .env.local."
          : groqResponse.status === 403
            ? "This Groq project cannot use the selected model. Check GROQ_MODEL."
            : groqResponse.status === 429
              ? "The free Groq request limit has been reached temporarily. Wait for it to reset and try again."
              : groqResponse.status === 400
                ? providerMessage || "Groq rejected the dialogue request. Check the selected model."
                : providerMessage || "Groq could not create the dialogue scene.";

      return Response.json({ error: safeMessage }, { status: 502 });
    }

    const outputText = payload.choices?.[0]?.message?.content?.trim();
    if (!outputText) {
      return Response.json(
        { error: "The Dialogue Generator returned an empty result. Please try again." },
        { status: 502 },
      );
    }

    const dialogue = parseDialogueBlueprint(outputText);

    return Response.json(
      {
        sceneTitle: dialogue.sceneTitle,
        sceneSubtitle: dialogue.sceneSubtitle,
        summary: dialogue.promptUnderstanding,
        sceneSetup: dialogue.sceneSetup,
        characterVoiceGuide: dialogue.characterVoiceGuide,
        dialogueLines: dialogue.dialogueLines,
        emotionalBeats: dialogue.emotionalBeats,
        branchingChoices: dialogue.branchingChoices,
        subtextAndIntent: dialogue.subtextAndIntent,
        performanceDirection: dialogue.performanceDirection,
        continuityAndConsequences: dialogue.continuityAndConsequences,
        implementationNotes: dialogue.implementationNotes,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Dialogue generation failed:", error);
    return Response.json(
      {
        error:
          error instanceof Error && error.message
            ? error.message
            : "The dialogue scene could not be generated. Please try again.",
      },
      { status: 500 },
    );
  }
}
