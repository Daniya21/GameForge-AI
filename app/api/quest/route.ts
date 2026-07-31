const ALLOWED_TYPES = [
  "Main Quest",
  "Side Quest",
  "Companion Quest",
  "Mystery Quest",
  "Boss Quest",
  "Exploration Quest",
] as const;

const ALLOWED_TONES = [
  "Epic",
  "Dark",
  "Emotional",
  "Mysterious",
  "Heroic",
  "Comedic",
] as const;

const ALLOWED_DIFFICULTIES = [
  "Accessible",
  "Moderate",
  "Challenging",
  "Brutal",
] as const;

type QuestRequest = {
  prompt?: unknown;
  questType?: unknown;
  setting?: unknown;
  tone?: unknown;
  difficulty?: unknown;
  rewardPreference?: unknown;
  specialRequirements?: unknown;
};

type QuestBlueprint = {
  questTitle: string;
  questSubtitle: string;
  premiseUnderstanding: string;
  questSummary: string;
  playerMotivation: string;
  startingTrigger: string;
  keyCharacters: string[];
  objectiveChain: string[];
  encountersAndChallenges: string;
  branchingChoices: string[];
  meaningfulConsequences: string;
  failureAndRecovery: string;
  rewards: string;
  worldStateChanges: string;
  optionalSecrets: string;
  pacingAndDuration: string;
  implementationNotes: string;
};

type QuestContext = {
  prompt: string;
  questType: string;
  setting: string;
  tone: string;
  difficulty: string;
  rewardPreference: string;
  specialRequirements: string;
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

const QUEST_JSON_SCHEMA = {
  type: "object",
  properties: {
    questTitle: { type: "string" },
    questSubtitle: { type: "string" },
    premiseUnderstanding: { type: "string" },
    questSummary: { type: "string" },
    playerMotivation: { type: "string" },
    startingTrigger: { type: "string" },
    keyCharacters: {
      type: "array",
      items: { type: "string" },
    },
    objectiveChain: {
      type: "array",
      items: { type: "string" },
    },
    encountersAndChallenges: { type: "string" },
    branchingChoices: {
      type: "array",
      items: { type: "string" },
    },
    meaningfulConsequences: { type: "string" },
    failureAndRecovery: { type: "string" },
    rewards: { type: "string" },
    worldStateChanges: { type: "string" },
    optionalSecrets: { type: "string" },
    pacingAndDuration: { type: "string" },
    implementationNotes: { type: "string" },
  },
  required: [
    "questTitle",
    "questSubtitle",
    "premiseUnderstanding",
    "questSummary",
    "playerMotivation",
    "startingTrigger",
    "keyCharacters",
    "objectiveChain",
    "encountersAndChallenges",
    "branchingChoices",
    "meaningfulConsequences",
    "failureAndRecovery",
    "rewards",
    "worldStateChanges",
    "optionalSecrets",
    "pacingAndDuration",
    "implementationNotes",
  ],
  additionalProperties: false,
} as const;

const QUEST_SYSTEM_PROMPT = `You are GameForge AI's senior quest designer, narrative systems designer, and gameplay writer.

Create one complete, playable video-game quest that deeply understands and faithfully expands the user's prompt. The user's prompt is the source of truth. The selected quest type, tone, difficulty, setting, reward preference, and special requirements are binding constraints.

NON-NEGOTIABLE RULES:
1. Preserve the exact central event, request, character relationship, goal, conflict, location, and intended outcome expressed by the user. Never replace the prompt with a generic quest template.
2. Correct spelling and grammar silently. Understand informal, incomplete, or simple human language without criticizing it.
3. Every objective must causally follow from the previous objective and directly advance the quest's central problem.
4. Make the quest playable. Include a clear trigger, player motivation, named characters, concrete objectives, varied challenges, choices, consequences, rewards, failure handling, and world-state changes.
5. Do not automatically add a cult, ancient prophecy, secret royal bloodline, betrayal, magical artifact, or world-ending threat unless the user's prompt genuinely supports it.
6. Avoid filler such as "investigate the area" unless you specify exactly what the player investigates, how they do it, what evidence they find, and how it changes the next step.
7. Branching choices must be meaningfully different, not cosmetic. Each choice must alter relationships, access, rewards, information, or the world state.
8. Rewards must fit the selected preference and the actions performed. Include at least one non-material reward such as reputation, access, relationship change, knowledge, or a persistent world effect.
9. Respect quest scale. A side quest should not casually become a world-saving campaign; a main quest should feel substantial and connected to the game's larger conflict.
10. Difficulty must come from interesting decisions, execution, resource pressure, investigation, navigation, social tension, or combat design—not only inflated enemy strength.
11. Use concrete names, places, objects, clues, actions, and consequences. Avoid vague design advice.
12. Return only the requested JSON fields. Do not include markdown, code fences, commentary, or text outside the JSON.
13. keyCharacters must contain 2 to 5 complete strings. objectiveChain must contain 4 to 8 complete sequential strings. branchingChoices must contain 2 to 4 complete strings, each including its outcome.

13. All quest spaces, equipment, interactables, rewards, enemies, and environmental descriptions must be compatible with the locked GameForge Stylized 3D art system and a single-player implementation. Never require photorealistic, 2D, pixel-art, sprite-only, or multiplayer-only production.

Before returning, silently review the quest for prompt alignment, logical progression, playable objectives, meaningful choices, and satisfying consequences. Rewrite any generic or disconnected section. Do not reveal this review process.`;

function isAllowed<T extends readonly string[]>(value: string, allowed: T): value is T[number] {
  return allowed.includes(value as T[number]);
}

function supportsStrictSchema(model: string) {
  return model === "openai/gpt-oss-20b" || model === "openai/gpt-oss-120b";
}

function cleanJsonContent(content: string) {
  return content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const record = value as Record<string, unknown>;
  for (const key of ["quest", "questBlueprint", "quest_blueprint", "data", "result"]) {
    const nested = record[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return nested as Record<string, unknown>;
    }
  }

  return record;
}

function asText(value: unknown, fallback: string) {
  if (typeof value === "string" && value.trim()) return value.trim();

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return fallback;
}

function objectToText(value: Record<string, unknown>) {
  const preferredKeys = [
    "description",
    "summary",
    "objective",
    "text",
    "name",
    "title",
    "outcome",
    "consequence",
    "role",
  ];

  const parts = preferredKeys
    .map((key) => value[key])
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());

  if (parts.length) return Array.from(new Set(parts)).join(" — ");

  return Object.values(value)
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .join(" — ");
}

function asStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object" && !Array.isArray(item)) {
          return objectToText(item as Record<string, unknown>);
        }
        return "";
      })
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\n+|\s*;\s*/)
      .map((item) => item.replace(/^[-*\d.)\s]+/, "").trim())
      .filter(Boolean);
  }

  return [];
}

function makeTitle(prompt: string) {
  const words = prompt
    .replace(/[^a-zA-Z0-9' -]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 7);

  const title = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  return title || "The Unwritten Quest";
}

function ensureArrayLength(items: string[], fallbacks: string[], minimum: number, maximum: number) {
  const unique = Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

  for (const fallback of fallbacks) {
    if (unique.length >= minimum) break;
    if (!unique.includes(fallback)) unique.push(fallback);
  }

  return unique.slice(0, maximum);
}

function normalizeQuestBlueprint(value: unknown, context: QuestContext): QuestBlueprint {
  const record = asRecord(value);
  const location = context.setting || "the established game world";
  const reward = context.rewardPreference || "a practical reward tied to the quest's central action";
  const title = makeTitle(context.prompt);

  const keyCharacters = ensureArrayLength(
    asStringArray(record.keyCharacters),
    [
      `The Player — the person responsible for resolving the central problem: ${context.prompt}`,
      `The Quest Contact — the person who reveals the stakes and provides access to ${location}`,
    ],
    2,
    5,
  );

  const objectiveChain = ensureArrayLength(
    asStringArray(record.objectiveChain),
    [
      `Receive the quest trigger, confirm the immediate stakes, and identify the first actionable lead connected to: ${context.prompt}`,
      `Travel to the relevant area in ${location}, overcome the first ${context.difficulty.toLowerCase()} obstacle, and obtain concrete information that reveals the next step.`,
      `Use the gathered information to confront the central challenge while protecting the quest's intended outcome and respecting: ${context.specialRequirements || "the player's chosen approach"}.`,
      `Make the decisive choice, complete the final objective, and return or escape so the consequences can update the world state.`,
    ],
    4,
    8,
  );

  const branchingChoices = ensureArrayLength(
    asStringArray(record.branchingChoices),
    [
      `Complete the objective directly and publicly — this produces the clearest immediate result, but changes how local characters and factions view the player.`,
      `Use a quieter or negotiated solution — this preserves a relationship or source of information, but changes access, rewards, or the final world-state outcome.`,
    ],
    2,
    4,
  );

  return {
    questTitle: asText(record.questTitle, title),
    questSubtitle: asText(record.questSubtitle, `${context.questType} • ${context.tone}`),
    premiseUnderstanding: asText(
      record.premiseUnderstanding,
      `The quest must remain centered on the user's exact idea: ${context.prompt}. It takes place in ${location} and should feel ${context.tone.toLowerCase()} without changing the requested premise.`,
    ),
    questSummary: asText(
      record.questSummary,
      `The player becomes involved in ${context.prompt}. They must follow a connected chain of actions in ${location}, overcome ${context.difficulty.toLowerCase()} pressure, make a meaningful decision, and leave a visible consequence in the world.`,
    ),
    playerMotivation: asText(
      record.playerMotivation,
      `The player accepts because the central situation creates an immediate personal, practical, or moral reason to act, and because success grants ${reward}.`,
    ),
    startingTrigger: asText(
      record.startingTrigger,
      `The quest begins when the player directly witnesses or receives credible evidence of the situation described in the prompt, creating a clear first objective rather than a vague invitation.`,
    ),
    keyCharacters,
    objectiveChain,
    encountersAndChallenges: asText(
      record.encountersAndChallenges,
      `Use a mixture of navigation, interaction, information gathering, environmental pressure, and an appropriate confrontation. Difficulty should come from decisions and execution rather than inflated enemy health.`,
    ),
    branchingChoices,
    meaningfulConsequences: asText(
      record.meaningfulConsequences,
      `The final approach changes at least one relationship, one source of access or information, the reward outcome, and a visible condition in ${location}.`,
    ),
    failureAndRecovery: asText(
      record.failureAndRecovery,
      `Failure returns the player to the latest fair checkpoint while preserving discovered information. A failed optional approach should close or alter that branch instead of deleting all progress.`,
    ),
    rewards: asText(
      record.rewards,
      `${reward}, plus a lasting non-material reward such as reputation, access, knowledge, a relationship change, or a persistent world-state benefit.`,
    ),
    worldStateChanges: asText(
      record.worldStateChanges,
      `NPC behaviour, local dialogue, access, and environmental details in ${location} change to reflect the player's final decision and the resolution of the central conflict.`,
    ),
    optionalSecrets: asText(
      record.optionalSecrets,
      `Careful exploration can reveal an optional clue, shortcut, or personal detail that improves the player's understanding and unlocks an alternate approach without replacing the main premise.`,
    ),
    pacingAndDuration: asText(
      record.pacingAndDuration,
      `Target 20–35 minutes for a focused ${context.questType.toLowerCase()}, with a clear opening, escalating middle, decisive choice, and short consequence scene.`,
    ),
    implementationNotes: asText(
      record.implementationNotes,
      `Implement explicit objective triggers, checkpoint states, dialogue conditions, branch flags, reward flags, and a final world-state variable. Keep every interaction tied to the user's prompt and selected difficulty.`,
    ),
  };
}

function parseQuestBlueprint(content: string, context: QuestContext): QuestBlueprint {
  const cleaned = cleanJsonContent(content);
  const parsed = JSON.parse(cleaned) as unknown;
  return normalizeQuestBlueprint(parsed, context);
}

function questToSections(quest: QuestBlueprint) {
  return [
    { title: "Premise Understanding", content: quest.premiseUnderstanding },
    { title: "Quest Summary", content: quest.questSummary },
    { title: "Why the Player Accepts", content: quest.playerMotivation },
    { title: "Starting Trigger", content: quest.startingTrigger },
    {
      title: "Key Characters",
      content: quest.keyCharacters.map((item, index) => `${index + 1}. ${item}`).join("\n"),
    },
    {
      title: "Objective Chain",
      content: quest.objectiveChain.map((item, index) => `${index + 1}. ${item}`).join("\n"),
    },
    { title: "Encounters & Challenges", content: quest.encountersAndChallenges },
    {
      title: "Branching Choices",
      content: quest.branchingChoices.map((item, index) => `${index + 1}. ${item}`).join("\n"),
    },
    { title: "Meaningful Consequences", content: quest.meaningfulConsequences },
    { title: "Failure & Recovery", content: quest.failureAndRecovery },
    { title: "Rewards", content: quest.rewards },
    { title: "World-State Changes", content: quest.worldStateChanges },
    { title: "Optional Secrets", content: quest.optionalSecrets },
    { title: "Pacing & Duration", content: quest.pacingAndDuration },
    { title: "Implementation Notes", content: quest.implementationNotes },
  ];
}

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(request: Request) {
  let body: QuestRequest;

  try {
    body = (await request.json()) as QuestRequest;
  } catch {
    return Response.json({ error: "The request body must be valid JSON." }, { status: 400 });
  }

  const context: QuestContext = {
    prompt: typeof body.prompt === "string" ? body.prompt.trim() : "",
    questType: typeof body.questType === "string" ? body.questType.trim() : "",
    setting: typeof body.setting === "string" ? body.setting.trim() : "",
    tone: typeof body.tone === "string" ? body.tone.trim() : "",
    difficulty: typeof body.difficulty === "string" ? body.difficulty.trim() : "",
    rewardPreference:
      typeof body.rewardPreference === "string" ? body.rewardPreference.trim() : "",
    specialRequirements:
      typeof body.specialRequirements === "string" ? body.specialRequirements.trim() : "",
  };

  if (context.prompt.length < 12) {
    return Response.json(
      { error: "Describe the quest idea in at least 12 characters." },
      { status: 400 },
    );
  }

  if (context.prompt.length > 2200) {
    return Response.json(
      { error: "The quest prompt is too long. Keep it below 2,200 characters." },
      { status: 400 },
    );
  }

  if (
    context.setting.length > 900 ||
    context.rewardPreference.length > 300 ||
    context.specialRequirements.length > 700
  ) {
    return Response.json(
      { error: "One of the optional quest fields is too long. Please shorten it." },
      { status: 400 },
    );
  }

  if (!isAllowed(context.questType, ALLOWED_TYPES)) {
    return Response.json({ error: "Please select a valid quest type." }, { status: 400 });
  }

  if (!isAllowed(context.tone, ALLOWED_TONES)) {
    return Response.json({ error: "Please select a valid quest tone." }, { status: 400 });
  }

  if (!isAllowed(context.difficulty, ALLOWED_DIFFICULTIES)) {
    return Response.json({ error: "Please select a valid difficulty." }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error:
          "Quest Generator is not connected. Add GROQ_API_KEY to .env.local and restart the development server.",
      },
      { status: 503 },
    );
  }

  const model =
    process.env.GROQ_FAST_MODEL?.trim() ||
    process.env.GROQ_MODEL?.trim() ||
    "openai/gpt-oss-20b";

  const strictSchema = supportsStrictSchema(model);

  try {
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.45,
        max_completion_tokens: 4200,
        response_format: strictSchema
          ? {
              type: "json_schema",
              json_schema: {
                name: "gameforge_quest_blueprint",
                strict: true,
                schema: QUEST_JSON_SCHEMA,
              },
            }
          : { type: "json_object" },
        messages: [
          { role: "system", content: QUEST_SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify(
              {
                task: "Create a complete, coherent, playable video-game quest.",
                questPrompt: context.prompt,
                questType: context.questType,
                gameWorldOrSetting:
                  context.setting ||
                  "Not separately provided; infer only what is necessary from the quest prompt.",
                tone: context.tone,
                difficulty: context.difficulty,
                preferredReward:
                  context.rewardPreference ||
                  "Infer an appropriate reward from the quest actions and setting.",
                specialRequirements:
                  context.specialRequirements ||
                  "No extra requirements; prioritize clarity and meaningful player agency.",
                requiredCounts: {
                  keyCharacters: "2 to 5 complete strings",
                  objectiveChain: "4 to 8 concrete sequential objective strings",
                  branchingChoices: "2 to 4 meaningful choice strings, each including its outcome",
                },
                qualityChecks: [
                  "The quest specifically follows the user's prompt.",
                  "Every objective causes or unlocks the next objective.",
                  "Choices alter relationships, information, rewards, access, or world state.",
                  "Rewards include both a practical reward and a persistent narrative or world-state reward.",
                  "All required fields are complete and non-empty.",
                ],
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
            ? "This Groq project cannot use the selected model. Check GROQ_FAST_MODEL or GROQ_MODEL."
            : groqResponse.status === 429
              ? "The Groq request limit has been reached. Check your Groq billing or wait for the limit to reset."
              : groqResponse.status === 400
                ? providerMessage || "Groq rejected the quest request. Check the selected model."
                : providerMessage || "Groq could not create the quest.";

      return Response.json({ error: safeMessage }, { status: 502 });
    }

    const outputText = payload.choices?.[0]?.message?.content?.trim();
    if (!outputText) {
      return Response.json(
        { error: "The Quest Generator returned an empty result. Please try again." },
        { status: 502 },
      );
    }

    let quest: QuestBlueprint;
    try {
      quest = parseQuestBlueprint(outputText, context);
    } catch (error) {
      console.error("Quest JSON parsing failed; using safe quest recovery:", error);
      quest = normalizeQuestBlueprint({}, context);
    }

    return Response.json(
      {
        questTitle: quest.questTitle,
        questSubtitle: quest.questSubtitle,
        summary: quest.questSummary,
        sections: questToSections(quest),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Quest generation failed:", error);
    return Response.json(
      {
        error:
          error instanceof Error && error.message
            ? error.message
            : "The quest could not be generated. Please try again.",
      },
      { status: 500 },
    );
  }
}
