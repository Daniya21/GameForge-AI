import { LOCKED_ART_STYLE, sanitizeStylized3DNotes } from "@/lib/art-direction/stylized-3d";

const ALLOWED_ARCHETYPES = [
  "Hero",
  "Antihero",
  "Mentor",
  "Rival",
  "Villain",
  "Companion",
] as const;

const ALLOWED_STYLES = [LOCKED_ART_STYLE] as const;

const ALLOWED_FRAMING = ["Full-Body Character Card"] as const;

type CharacterRequest = {
  concept?: unknown;
  world?: unknown;
  archetype?: unknown;
  artStyle?: unknown;
  framing?: unknown;
  visualNotes?: unknown;
};

type CharacterProfile = {
  name: string;
  epithet: string;
  oneLineConcept: string;
  roleInWorld: string;
  personality: string;
  motivation: string;
  backstory: string;
  abilities: string[];
  definingFlaw: string;
  gameplayIdentity: string;
  relationships: string;
  visualIdentity: string;
  voiceAndMannerisms: string;
  avatarPrompt: string;
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


type CloudflareResponse = {
  result?: { image?: string };
  success?: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  messages?: Array<{ code?: number; message?: string }>;
};
const REQUIRED_STRING_FIELDS: Array<keyof Omit<CharacterProfile, "abilities">> = [
  "name",
  "epithet",
  "oneLineConcept",
  "roleInWorld",
  "personality",
  "motivation",
  "backstory",
  "definingFlaw",
  "gameplayIdentity",
  "relationships",
  "visualIdentity",
  "voiceAndMannerisms",
  "avatarPrompt",
];

const CHARACTER_SYSTEM_PROMPT = `You are GameForge AI's senior character director, game writer, and visual development artist.

Create one original, memorable video-game character that faithfully develops the user's concept, world, archetype, visual notes, art style, and framing choice.

NON-NEGOTIABLE RULES:
1. The user's concept and world are the source of truth. Never replace them with a reusable generic character template.
2. Every trait, motivation, ability, flaw, costume detail, and gameplay mechanic must have a clear cause in the character's history or world.
3. Correct informal language and spelling silently. Infer missing details carefully without changing the user's central intention.
4. Give the character a distinctive name, silhouette, personal contradiction, playable identity, and specific visual storytelling details.
5. Avoid chosen-one clichés, vague tragic pasts, generic elemental powers, and random accessories unless they genuinely follow from the prompt.
6. The character must be suitable for an original commercial game. Do not copy an existing copyrighted character, celebrity, real person, brand, logo, or living artist's signature style.
7. Keep the design safe and non-sexual. The avatar must show a fully clothed original character.
8. avatarPrompt must be a single detailed English image-generation prompt for a complete head-to-toe stylized 3D game character reference. The character must stand in a neutral A-pose with both arms separated from the torso, both hands visible, both feet visible, front three-quarter view, clean plain background, and no environmental props.
9. avatarPrompt must not include the character's written name, captions, typography, UI, logos, watermarks, multiple people, cropped limbs, seated poses, dramatic perspective, or instructions to generate text.
10. Return ONLY one valid JSON object. Do not include markdown, code fences, commentary, or text outside the JSON.

Before returning, silently check that the character is specific, coherent, playable, visually distinctive, and strongly aligned with every user input. Rewrite weak or generic details. Do not reveal this review process.`;

function isAllowed<T extends readonly string[]>(value: string, allowed: T): value is T[number] {
  return allowed.includes(value as T[number]);
}

function isCharacterProfile(value: unknown): value is CharacterProfile {
  if (!value || typeof value !== "object") return false;

  const record = value as Record<string, unknown>;

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof record[field] !== "string" || !record[field].trim()) {
      return false;
    }
  }

  return (
    Array.isArray(record.abilities) &&
    record.abilities.length >= 3 &&
    record.abilities.every(
      (ability) => typeof ability === "string" && ability.trim().length > 0,
    )
  );
}

function parseCharacterProfile(content: string): CharacterProfile {
  const parsed = JSON.parse(content) as unknown;

  if (!isCharacterProfile(parsed)) {
    throw new Error("The AI returned an incomplete character profile. Please try again.");
  }

  return {
    ...parsed,
    abilities: parsed.abilities.slice(0, 4),
  };
}

function profileToSections(profile: CharacterProfile) {
  return [
    { title: "Character Identity", content: `${profile.name} — ${profile.epithet}` },
    { title: "Core Concept", content: profile.oneLineConcept },
    { title: "Role in the World", content: profile.roleInWorld },
    { title: "Personality", content: profile.personality },
    { title: "Motivation", content: profile.motivation },
    { title: "Backstory", content: profile.backstory },
    {
      title: "Signature Abilities",
      content: profile.abilities.map((ability, index) => `${index + 1}. ${ability}`).join("\n"),
    },
    { title: "Defining Flaw", content: profile.definingFlaw },
    { title: "Gameplay Identity", content: profile.gameplayIdentity },
    { title: "Key Relationships", content: profile.relationships },
    { title: "Visual Identity", content: profile.visualIdentity },
    { title: "Voice & Mannerisms", content: profile.voiceAndMannerisms },
  ];
}

function buildAvatarPrompt(
  profile: CharacterProfile,
  _artStyle: string,
  _framing: string,
) {
  return [
    "Create one original fictional playable video-game character as a premium stylized 3D model reference",
    profile.avatarPrompt,
    "head-to-toe full body visible, neutral A-pose, arms slightly away from torso, hands open and visible, feet fully visible, balanced standing stance, front three-quarter orthographic-like view",
    "clean readable silhouette, expressive stylized proportions, polished sculpted forms, hand-painted PBR-like materials, optimized game-character design, symmetrical anatomy, clothing layers clearly separated for 3D reconstruction",
    "plain light neutral studio background, soft three-point lighting, minimal ground shadow",
    "single character only, fully clothed, no environment, no props blocking the body, no cropped limbs, no duplicate limbs, no extra fingers, no text, no title, no logo, no watermark, no UI, no border",
  ].join(", ").slice(0, 2300);
}

async function createAvatar(prompt: string) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

  if (!accountId || !apiToken) {
    return {
      avatarDataUrl: null,
      avatarError:
        "Character profile created, but Cloudflare avatar rendering is not connected. Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to .env.local, then restart the server.",
    };
  }

  const imageModel = process.env.CLOUDFLARE_IMAGE_MODEL?.trim() || "@cf/black-forest-labs/flux-1-schnell";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 100_000);

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${imageModel}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          steps: 8,
          seed: Math.floor(Math.random() * 2_147_483_646) + 1,
        }),
        signal: controller.signal,
      },
    );

    const payload = (await response.json().catch(() => ({}))) as CloudflareResponse;
    if (!response.ok || payload.success === false) {
      const providerMessage = payload.errors?.[0]?.message || payload.messages?.[0]?.message;
      const safeMessage =
        response.status === 401 || response.status === 403
          ? "Avatar rendering could not authenticate with Cloudflare. Check the Account ID and Workers AI API token in .env.local."
          : response.status === 429
            ? "Cloudflare's free Workers AI allocation or temporary rate limit has been reached. Try again after the limit resets."
            : providerMessage || "Cloudflare could not render the avatar.";
      return { avatarDataUrl: null, avatarError: safeMessage };
    }

    const imageBase64 = payload.result?.image?.trim();
    if (!imageBase64) {
      return { avatarDataUrl: null, avatarError: "Cloudflare returned an empty avatar image. Please generate again." };
    }

    return { avatarDataUrl: `data:image/jpeg;base64,${imageBase64}`, avatarError: null };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Avatar rendering took too long and was stopped. Please try again."
        : "Avatar rendering could not be completed. Check your connection and Cloudflare setup.";
    return { avatarDataUrl: null, avatarError: message };
  } finally {
    clearTimeout(timeout);
  }
}

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  let body: CharacterRequest;

  try {
    body = (await request.json()) as CharacterRequest;
  } catch {
    return Response.json({ error: "The request body must be valid JSON." }, { status: 400 });
  }

  const concept = typeof body.concept === "string" ? body.concept.trim() : "";
  const world = typeof body.world === "string" ? body.world.trim() : "";
  const archetype = typeof body.archetype === "string" ? body.archetype.trim() : "";
  const artStyle = LOCKED_ART_STYLE;
  const framing = "Full-Body Character Card";
  const visualNotes = sanitizeStylized3DNotes(body.visualNotes, 700);

  if (concept.length < 12) {
    return Response.json(
      { error: "Describe the character concept in at least 12 characters." },
      { status: 400 },
    );
  }

  if (concept.length > 1800) {
    return Response.json(
      { error: "The character concept is too long. Keep it below 1,800 characters." },
      { status: 400 },
    );
  }

  if (world.length < 8) {
    return Response.json(
      { error: "Describe the world or setting in at least 8 characters." },
      { status: 400 },
    );
  }

  if (world.length > 1400 || visualNotes.length > 700) {
    return Response.json(
      { error: "One of the character fields is too long. Shorten the setting or visual notes." },
      { status: 400 },
    );
  }

  if (!isAllowed(archetype, ALLOWED_ARCHETYPES)) {
    return Response.json({ error: "Please select a valid archetype." }, { status: 400 });
  }

  if (!isAllowed(artStyle, ALLOWED_STYLES)) {
    return Response.json({ error: "Please select a valid art style." }, { status: 400 });
  }

  if (!isAllowed(framing, ALLOWED_FRAMING)) {
    return Response.json({ error: "Please select a valid avatar framing." }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error:
          "Character AI is not connected. Add GROQ_API_KEY to .env.local and restart the development server.",
      },
      { status: 503 },
    );
  }

  const model = process.env.GROQ_FAST_MODEL?.trim() || process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-20b";

  const requestedShape = {
    name: "string",
    epithet: "string",
    oneLineConcept: "string",
    roleInWorld: "string",
    personality: "string",
    motivation: "string",
    backstory: "string",
    abilities: ["three or four specific ability strings"],
    definingFlaw: "string",
    gameplayIdentity: "string",
    relationships: "string",
    visualIdentity: "string",
    voiceAndMannerisms: "string",
    avatarPrompt: "one detailed visual-only image prompt string",
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
        max_completion_tokens: 3000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: CHARACTER_SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify(
              {
                task: "Create a complete original game character profile and a precise avatar image prompt.",
                characterConcept: concept,
                worldOrSetting: world,
                archetype,
                artStyle,
                avatarFraming: framing,
                visualNotes: visualNotes || "No additional visual notes; infer them from the concept and setting.",
                requiredJsonShape: requestedShape,
                requirements: {
                  alignment: "Every section must clearly develop the user's character concept and world.",
                  originality: "Create a new character, not a renamed existing franchise character.",
                  visualSpecificity:
                    "Describe concrete facial features, silhouette, costume layers, materials, equipment, expression, pose, and lighting.",
                  gameplaySpecificity:
                    "Abilities and gameplay identity must be playable and connected to the biography.",
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
                ? providerMessage || "Groq rejected the character request. Check the model name."
                : providerMessage || "Groq could not create the character profile.";

      return Response.json({ error: safeMessage }, { status: 502 });
    }

    const outputText = payload.choices?.[0]?.message?.content?.trim();
    if (!outputText) {
      return Response.json(
        { error: "The Character AI returned an empty result. Please try again." },
        { status: 502 },
      );
    }

    const profile = parseCharacterProfile(outputText);
    const avatarPrompt = buildAvatarPrompt(profile, artStyle, framing);
    const avatar = await createAvatar(avatarPrompt);

    return Response.json(
      {
        characterName: profile.name,
        characterEpithet: profile.epithet,
        summary: profile.oneLineConcept,
        sections: profileToSections(profile),
        avatarPrompt,
        avatarDataUrl: avatar.avatarDataUrl,
        avatarError: avatar.avatarError,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Character generation failed:", error);
    return Response.json(
      {
        error:
          error instanceof Error && error.message
            ? error.message
            : "The character could not be generated. Please try again.",
      },
      { status: 500 },
    );
  }
}
