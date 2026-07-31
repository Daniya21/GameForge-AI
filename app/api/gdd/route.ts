import {
  LOCKED_ART_DIRECTION,
  LOCKED_ART_STYLE,
  buildStylized3DPrompt,
  lockedArtDirectionWithNotes,
  sanitizeStylized3DNotes,
} from "@/lib/art-direction/stylized-3d";

const ALLOWED_STYLES = [
  "Pitch-ready",
  "Detailed production",
  "Student project",
  "Prototype brief",
] as const;

const ALLOWED_PLATFORMS = [
  "PC",
  "Console",
  "Mobile",
  "Web",
  "VR / AR",
  "Cross-platform",
] as const;

const ALLOWED_STAGES = [
  "Early concept",
  "Pre-production",
  "Prototype",
  "Vertical slice",
  "Production planning",
] as const;

const ALLOWED_TEAM_SIZES = [
  "Solo developer",
  "2-5 people",
  "6-15 people",
  "16-40 people",
  "Large studio",
] as const;

type GddRequest = {
  title?: unknown;
  concept?: unknown;
  genre?: unknown;
  platform?: unknown;
  audience?: unknown;
  documentStyle?: unknown;
  projectStage?: unknown;
  teamSize?: unknown;
  visualDirection?: unknown;
};

type GddDocument = {
  title: string;
  subtitle: string;
  oneLinePitch: string;
  executiveSummary: string;
  genreAndFormat: string;
  targetAudience: string;
  platformsAndSession: string;
  playerFantasy: string;
  designPillars: string[];
  uniqueSellingPoints: string[];
  coreLoop: string[];
  momentToMomentGameplay: string;
  coreMechanics: string[];
  controlsAndFeedback: string;
  progressionAndRewards: string;
  narrativeAndWorld: string;
  charactersAndFactions: string;
  levelsAndContent: string;
  visualDirection: string;
  audioDirection: string;
  uiUxAndAccessibility: string;
  technicalPlan: string;
  mvpScope: string[];
  productionMilestones: string[];
  risksAndMitigations: string[];
  successMetrics: string[];
  openQuestions: string[];
  coverImagePrompt: string;
};

type GddContext = {
  title: string;
  concept: string;
  genre: string;
  platform: string;
  audience: string;
  documentStyle: string;
  projectStage: string;
  teamSize: string;
  visualDirection: string;
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

const GDD_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    oneLinePitch: { type: "string" },
    executiveSummary: { type: "string" },
    genreAndFormat: { type: "string" },
    targetAudience: { type: "string" },
    platformsAndSession: { type: "string" },
    playerFantasy: { type: "string" },
    designPillars: { type: "array", items: { type: "string" } },
    uniqueSellingPoints: { type: "array", items: { type: "string" } },
    coreLoop: { type: "array", items: { type: "string" } },
    momentToMomentGameplay: { type: "string" },
    coreMechanics: { type: "array", items: { type: "string" } },
    controlsAndFeedback: { type: "string" },
    progressionAndRewards: {
      type: "array",
      items: { type: "string" },
      minItems: 3,
      maxItems: 5,
    },
    narrativeAndWorld: { type: "string" },
    charactersAndFactions: { type: "string" },
    levelsAndContent: { type: "string" },
    visualDirection: { type: "string" },
    audioDirection: { type: "string" },
    uiUxAndAccessibility: { type: "string" },
    technicalPlan: { type: "string" },
    mvpScope: { type: "array", items: { type: "string" } },
    productionMilestones: { type: "array", items: { type: "string" } },
    risksAndMitigations: { type: "array", items: { type: "string" } },
    successMetrics: { type: "array", items: { type: "string" } },
    openQuestions: { type: "array", items: { type: "string" } },
    coverImagePrompt: { type: "string" },
  },
  required: [
    "title",
    "subtitle",
    "oneLinePitch",
    "executiveSummary",
    "genreAndFormat",
    "targetAudience",
    "platformsAndSession",
    "playerFantasy",
    "designPillars",
    "uniqueSellingPoints",
    "coreLoop",
    "momentToMomentGameplay",
    "coreMechanics",
    "controlsAndFeedback",
    "progressionAndRewards",
    "narrativeAndWorld",
    "charactersAndFactions",
    "levelsAndContent",
    "visualDirection",
    "audioDirection",
    "uiUxAndAccessibility",
    "technicalPlan",
    "mvpScope",
    "productionMilestones",
    "risksAndMitigations",
    "successMetrics",
    "openQuestions",
    "coverImagePrompt",
  ],
  additionalProperties: false,
} as const;

const GDD_SYSTEM_PROMPT = `You are GameForge AI's senior game director, systems designer, producer, and presentation editor.

Create a complete, professional Game Design Document presentation from the user's game concept. The output must be specific enough to guide a prototype or production discussion, but concise enough to present as a polished visual document.

NON-NEGOTIABLE RULES:
1. The user's concept is the source of truth. Understand informal wording and silently correct spelling without changing the central game idea.
2. Every section must describe this exact game, not a reusable generic template.
3. Connect the player fantasy, core loop, mechanics, progression, narrative, level design, visual identity, technical plan, and scope into one coherent product vision.
4. Separate confirmed ideas from reasonable design assumptions by phrasing assumptions carefully.
5. Keep the scope realistic for the stated team size and project stage. Do not design an impossible AAA game for a solo or small team.
6. Use clear production language that students, developers, artists, and potential stakeholders can understand.
7. Avoid copying existing games, franchises, brands, characters, or living artists' signature styles.
8. The visual medium is permanently locked to premium Stylized 3D. Never return photorealistic, 2D, pixel-art, sprite-based, or live-action visual direction. User visual notes may influence palette, mood, materials, architecture, and composition only.
9. The visualDirection and coverImagePrompt fields must explicitly preserve the locked Stylized 3D production language.
10. Arrays must contain specific, presentation-ready points rather than vague labels. progressionAndRewards must be an array of 3 to 5 concise strings covering unlocks, player growth, reward cadence, and meaningful choices.
11. coverImagePrompt must be one detailed visual-only English prompt for original Stylized 3D game key art. It must contain no typography, logos, UI, watermarks, or instructions to place text.
12. Return ONLY one valid JSON object. Do not include markdown, code fences, commentary, or text outside the JSON.
13. Return every required field even when the user's concept leaves details open. Make careful, clearly framed design assumptions instead of omitting sections.

Before returning, silently check alignment, internal consistency, feasibility, completeness, and presentation quality. Rewrite generic, missing, or contradictory sections. Do not reveal the review process.`;

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

function parseJsonObject(content: string): unknown {
  const cleaned = cleanJsonContent(content);

  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as unknown;
    }
    throw new Error("The GDD AI returned invalid JSON. Please generate again.");
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const record = value as Record<string, unknown>;
  for (const key of [
    "document",
    "gdd",
    "gameDesignDocument",
    "game_design_document",
    "data",
    "result",
  ]) {
    const nested = record[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return nested as Record<string, unknown>;
    }
  }

  return record;
}

function getField(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function objectToText(value: Record<string, unknown>) {
  const preferredKeys = [
    "description",
    "summary",
    "text",
    "title",
    "name",
    "detail",
    "action",
    "risk",
    "mitigation",
    "metric",
    "question",
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

function asText(value: unknown, fallback: string) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const joined = value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object" && !Array.isArray(item)) {
          return objectToText(item as Record<string, unknown>);
        }
        return "";
      })
      .filter(Boolean)
      .join(" ");
    if (joined) return joined;
  }
  if (value && typeof value === "object") {
    const text = objectToText(value as Record<string, unknown>);
    if (text) return text;
  }
  return fallback;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object" && !Array.isArray(item)) {
          return objectToText(item as Record<string, unknown>);
        }
        if (typeof item === "number" || typeof item === "boolean") return String(item);
        return "";
      })
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\n+|\s*;\s*/g)
      .map((item) => item.replace(/^[-*•\d.)\s]+/, "").trim())
      .filter(Boolean);
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .flatMap((item) => asStringArray(item))
      .filter(Boolean);
  }

  return [];
}

function ensureArrayLength(items: string[], fallbacks: string[], minimum: number, maximum: number) {
  const unique = Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

  for (const fallback of fallbacks) {
    if (unique.length >= minimum) break;
    if (!unique.includes(fallback)) unique.push(fallback);
  }

  return unique.slice(0, maximum);
}

function normalizeGddDocument(value: unknown, context: GddContext): GddDocument {
  const record = asRecord(value);
  const audience = context.audience || `Players most likely to enjoy ${context.genre.toLowerCase()} experiences`;
  const visualDirection = lockedArtDirectionWithNotes(context.visualDirection);

  const designPillars = ensureArrayLength(
    asStringArray(getField(record, "designPillars", "design_pillars", "pillars")),
    [
      `Deliver the central fantasy of ${context.concept} through clear player decisions and responsive feedback.`,
      `Make every major mechanic support the ${context.genre} experience instead of existing as disconnected features.`,
      `Keep content and systems achievable for ${context.teamSize} during ${context.projectStage.toLowerCase()}.`,
      `Use readable goals, meaningful consequences, and a consistent audiovisual identity across the full experience.`,
    ],
    3,
    4,
  );

  const uniqueSellingPoints = ensureArrayLength(
    asStringArray(getField(record, "uniqueSellingPoints", "unique_selling_points", "usps")),
    [
      `A game concept built specifically around: ${context.concept}`,
      `A coherent combination of ${context.genre} mechanics, progression, world design, and presentation rather than isolated features.`,
      `A scope-aware production plan designed for ${context.teamSize} and the ${context.projectStage.toLowerCase()} stage.`,
    ],
    3,
    4,
  );

  const coreLoop = ensureArrayLength(
    asStringArray(getField(record, "coreLoop", "core_loop", "gameplayLoop")),
    [
      `Receive or discover a clear objective connected to the central concept.`,
      `Explore the relevant space, gather information or resources, and prepare an approach.`,
      `Use the game's core ${context.genre} mechanics to overcome the main challenge.`,
      `Resolve the objective, receive feedback and rewards, and update the world or progression state.`,
      `Unlock a more demanding situation that recombines established mechanics with a new constraint.`,
    ],
    4,
    6,
  );

  const coreMechanics = ensureArrayLength(
    asStringArray(getField(record, "coreMechanics", "core_mechanics", "mechanics")),
    [
      `Responsive movement and interaction appropriate for ${context.platform}.`,
      `Objective and mission logic that turns the concept into playable, trackable actions.`,
      `Meaningful resource, ability, relationship, or equipment decisions tied to progression.`,
      `Clear success, failure, recovery, and feedback systems that preserve player agency.`,
      `Reusable encounter and content rules that allow the project to expand without rebuilding every system.`,
    ],
    4,
    6,
  );

  const mvpScope = ensureArrayLength(
    asStringArray(getField(record, "mvpScope", "mvp_scope", "minimumViableProduct")),
    [
      `One polished playable scenario that proves the central fantasy and complete core loop.`,
      `One production-ready player controller, camera, interaction layer, and feedback system for ${context.platform}.`,
      `A limited but representative environment and content set using reusable assets.`,
      `A complete objective sequence with success, failure, restart, and progression handling.`,
      `Basic UI, audio, accessibility options, performance profiling, and build validation.`,
    ],
    4,
    6,
  );

  const productionMilestones = ensureArrayLength(
    asStringArray(getField(record, "productionMilestones", "production_milestones", "milestones")),
    [
      `Concept lock: approve the core fantasy, target player, design pillars, technical constraints, and non-goals.`,
      `Prototype: prove movement, camera, the primary mechanic, objective flow, and basic failure recovery.`,
      `Vertical slice: combine representative art, audio, UI, content, and performance targets in one polished sequence.`,
      `Production build: expand reusable content, complete progression, improve onboarding, and run systematic playtests.`,
      `Release candidate: resolve critical defects, validate accessibility and performance, and prepare final presentation or deployment assets.`,
    ],
    4,
    6,
  );

  const risksAndMitigations = ensureArrayLength(
    asStringArray(getField(record, "risksAndMitigations", "risks_and_mitigations", "risks")),
    [
      `Scope expansion could exceed ${context.teamSize}; mitigate it by protecting the MVP, limiting unique systems, and reusing proven content modules.`,
      `The central mechanic may not feel satisfying early; mitigate it with a focused prototype and measurable playtest goals before content production.`,
      `Asset and performance demands may exceed the ${context.platform} budget; mitigate them with explicit polygon, texture, memory, and frame-time limits.`,
      `Narrative, missions, and mechanics may drift apart; mitigate this with shared design pillars and milestone reviews against the original concept.`,
    ],
    3,
    5,
  );

  const successMetrics = ensureArrayLength(
    asStringArray(getField(record, "successMetrics", "success_metrics", "metrics")),
    [
      `Most first-time players can understand the immediate objective and primary controls without developer assistance.`,
      `Playtesters can complete the full MVP loop without a blocking defect or unclear progression step.`,
      `The representative build meets its agreed frame-rate and loading targets on the target ${context.platform} hardware.`,
      `Post-playtest feedback shows that the intended player fantasy and strongest differentiator are clearly understood.`,
    ],
    3,
    5,
  );

  const openQuestions = ensureArrayLength(
    asStringArray(getField(record, "openQuestions", "open_questions", "questions")),
    [
      `Which single mechanic must feel exceptional for the concept to succeed?`,
      `What content should be cut first if the ${context.teamSize} production scope becomes too large?`,
      `Which parts of the world, story, or progression must be authored and which can be generated or reused?`,
      `What measurable quality bar defines a successful ${context.projectStage.toLowerCase()} build?`,
    ],
    3,
    5,
  );

  return {
    title: asText(getField(record, "title", "gameTitle", "game_title"), context.title),
    subtitle: asText(
      getField(record, "subtitle", "tagline"),
      `${context.genre} • ${context.documentStyle} GDD`,
    ),
    oneLinePitch: asText(
      getField(record, "oneLinePitch", "one_line_pitch", "pitch"),
      `${context.title} is a ${context.genre.toLowerCase()} game built around ${context.concept}`,
    ),
    executiveSummary: asText(
      getField(record, "executiveSummary", "executive_summary", "overview"),
      `${context.title} is a ${context.genre} project for ${context.platform}. Its central concept is ${context.concept} The ${context.documentStyle.toLowerCase()} plan prioritizes a coherent player fantasy, a testable core loop, and a realistic ${context.projectStage.toLowerCase()} scope for ${context.teamSize}.`,
    ),
    genreAndFormat: asText(
      getField(record, "genreAndFormat", "genre_and_format", "genre"),
      `${context.genre} designed for ${context.platform}, structured around a focused repeatable loop and content that can expand after the MVP is proven.`,
    ),
    targetAudience: asText(getField(record, "targetAudience", "target_audience", "audience"), audience),
    platformsAndSession: asText(
      getField(record, "platformsAndSession", "platforms_and_session", "platforms"),
      `Primary platform: ${context.platform}. Session structure should support clear short-term objectives while preserving progression across longer play sessions.`,
    ),
    playerFantasy: asText(
      getField(record, "playerFantasy", "player_fantasy", "fantasy"),
      `The player should feel personally responsible for mastering the decisions and actions required by this concept: ${context.concept}`,
    ),
    designPillars,
    uniqueSellingPoints,
    coreLoop,
    momentToMomentGameplay: asText(
      getField(record, "momentToMomentGameplay", "moment_to_moment_gameplay", "momentToMoment"),
      `Moment to moment, the player reads the situation, moves through the space, interacts with characters or objects, chooses an approach, executes the primary ${context.genre.toLowerCase()} mechanic, and receives immediate visual, audio, and systemic feedback.`,
    ),
    coreMechanics,
    controlsAndFeedback: asText(
      getField(record, "controlsAndFeedback", "controls_and_feedback", "controls"),
      `Controls should follow familiar ${context.platform} conventions, prioritize low-latency response, and communicate targeting, interaction availability, danger, success, damage, objectives, and progression through coordinated animation, sound, UI, and camera feedback.`,
    ),
    progressionAndRewards: asText(
      getField(record, "progressionAndRewards", "progression_and_rewards", "progression"),
      `Progression should reward mastery of the central loop through new options, access, relationships, information, equipment, or world-state changes. Rewards must change how the player plans or performs future objectives instead of only increasing numbers.`,
    ),
    narrativeAndWorld: asText(
      getField(record, "narrativeAndWorld", "narrative_and_world", "narrative", "world"),
      `The world and narrative exist to support ${context.concept}. Locations, conflicts, characters, and environmental details should continually reinforce the central fantasy and provide understandable reasons for each gameplay objective.`,
    ),
    charactersAndFactions: asText(
      getField(record, "charactersAndFactions", "characters_and_factions", "characters", "factions"),
      `Define a focused cast whose goals create gameplay pressure, information, assistance, or opposition. Each major character or faction should have a clear role in the central concept and a visible response to player decisions.`,
    ),
    levelsAndContent: asText(
      getField(record, "levelsAndContent", "levels_and_content", "levels", "contentPlan"),
      `Begin with one representative level or scenario that demonstrates the complete loop. Expand through modular spaces, escalating objectives, remixed constraints, and reusable encounter rules rather than relying only on one-off content.`,
    ),
    visualDirection: lockedArtDirectionWithNotes(
      asText(getField(record, "visualDirection", "visual_direction", "artDirection"), visualDirection),
    ),
    audioDirection: asText(
      getField(record, "audioDirection", "audio_direction", "soundDirection"),
      `Use a distinctive but production-feasible audio identity with readable interaction cues, environmental layers, state-based music or ambience, and restrained voice work focused on important narrative and gameplay moments.`,
    ),
    uiUxAndAccessibility: asText(
      getField(record, "uiUxAndAccessibility", "ui_ux_and_accessibility", "uiUx", "accessibility"),
      `The interface should prioritize current objectives, interaction states, progression, and risk without obscuring the play space. Include scalable text, remappable controls where possible, subtitle and audio controls, readable contrast, reduced-motion options, and alternatives to color-only information.`,
    ),
    technicalPlan: asText(
      getField(record, "technicalPlan", "technical_plan", "technology"),
      `Build a modular ${context.platform} prototype with separate systems for player control, camera, objectives, interaction, AI, save state, UI, audio, and content data. Set explicit performance budgets, use reusable assets, validate generated content, and maintain fallback behavior for external AI services.`,
    ),
    mvpScope,
    productionMilestones,
    risksAndMitigations,
    successMetrics,
    openQuestions,
    coverImagePrompt: buildStylized3DPrompt(
      asText(
        getField(record, "coverImagePrompt", "cover_image_prompt", "keyArtPrompt"),
        `Original cinematic video-game key art for ${context.title}, visually expressing ${context.concept}, ${visualDirection}, dramatic lighting, strong focal subject, layered environmental depth, premium presentation quality, no text, no title, no logo, no watermark, no interface`,
      ),
      "commercial game key art",
    ),
  };
}

function parseGddDocument(content: string, context: GddContext): GddDocument {
  try {
    return normalizeGddDocument(parseJsonObject(content), context);
  } catch (error) {
    console.warn("GDD JSON recovery was used:", error);
    return normalizeGddDocument({}, context);
  }
}

function documentToSections(document: GddDocument) {
  return [
    { title: "Executive Summary", content: document.executiveSummary },
    { title: "Genre & Game Format", content: document.genreAndFormat },
    { title: "Target Audience", content: document.targetAudience },
    { title: "Platforms & Session Design", content: document.platformsAndSession },
    { title: "Player Fantasy", content: document.playerFantasy },
    {
      title: "Design Pillars",
      content: document.designPillars.map((item, index) => `${index + 1}. ${item}`).join("\n"),
    },
    {
      title: "Unique Selling Points",
      content: document.uniqueSellingPoints.map((item, index) => `${index + 1}. ${item}`).join("\n"),
    },
    {
      title: "Core Gameplay Loop",
      content: document.coreLoop.map((item, index) => `${index + 1}. ${item}`).join("\n"),
    },
    { title: "Moment-to-Moment Gameplay", content: document.momentToMomentGameplay },
    {
      title: "Core Mechanics",
      content: document.coreMechanics.map((item, index) => `${index + 1}. ${item}`).join("\n"),
    },
    { title: "Controls & Player Feedback", content: document.controlsAndFeedback },
    { title: "Progression & Rewards", content: document.progressionAndRewards },
    { title: "Narrative & World", content: document.narrativeAndWorld },
    { title: "Characters & Factions", content: document.charactersAndFactions },
    { title: "Levels & Content Plan", content: document.levelsAndContent },
    { title: "Visual Direction", content: document.visualDirection },
    { title: "Audio Direction", content: document.audioDirection },
    { title: "UI, UX & Accessibility", content: document.uiUxAndAccessibility },
    { title: "Technical Plan", content: document.technicalPlan },
    {
      title: "Minimum Viable Product Scope",
      content: document.mvpScope.map((item, index) => `${index + 1}. ${item}`).join("\n"),
    },
    {
      title: "Production Milestones",
      content: document.productionMilestones.map((item, index) => `${index + 1}. ${item}`).join("\n"),
    },
    {
      title: "Risks & Mitigations",
      content: document.risksAndMitigations.map((item, index) => `${index + 1}. ${item}`).join("\n"),
    },
    {
      title: "Success Metrics",
      content: document.successMetrics.map((item, index) => `${index + 1}. ${item}`).join("\n"),
    },
    {
      title: "Open Design Questions",
      content: document.openQuestions.map((item, index) => `${index + 1}. ${item}`).join("\n"),
    },
  ];
}

async function createCoverImage(prompt: string) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

  if (!accountId || !apiToken) {
    return {
      coverImageDataUrl: null,
      coverImageError:
        "The GDD was created, but Cloudflare cover rendering is not connected. Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to .env.local.",
    };
  }

  const model = process.env.CLOUDFLARE_IMAGE_MODEL?.trim() || "@cf/black-forest-labs/flux-1-schnell";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 100_000);

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: [
            buildStylized3DPrompt(prompt, "GDD presentation cover"),
            LOCKED_ART_DIRECTION,
            "premium original video-game key art, cinematic composition, dramatic lighting, strong focal point, layered environment depth, presentation-cover quality",
            "no text, no title, no logo, no watermark, no UI, no border",
          ].join(", ").slice(0, 2048),
          steps: 8,
          seed: Math.floor(Math.random() * 2_147_483_646) + 1,
        }),
        signal: controller.signal,
      },
    );

    const payload = (await response.json().catch(() => ({}))) as CloudflareResponse;
    if (!response.ok || payload.success === false) {
      const providerMessage = payload.errors?.[0]?.message || payload.messages?.[0]?.message;
      const message =
        response.status === 401 || response.status === 403
          ? "GDD cover rendering could not authenticate with Cloudflare. Check the Account ID and Workers AI token."
          : response.status === 429
            ? "Cloudflare's free image allocation is temporarily reached. The GDD remains available without cover art."
            : providerMessage || "The GDD cover image could not be rendered.";
      return { coverImageDataUrl: null, coverImageError: message };
    }

    const image = payload.result?.image?.trim();
    if (!image) {
      return { coverImageDataUrl: null, coverImageError: "Cloudflare returned an empty GDD cover image." };
    }

    return { coverImageDataUrl: `data:image/jpeg;base64,${image}`, coverImageError: null };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "GDD cover rendering took too long and was stopped."
        : "GDD cover rendering could not reach Cloudflare Workers AI.";
    return { coverImageDataUrl: null, coverImageError: message };
  } finally {
    clearTimeout(timeout);
  }
}

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  let body: GddRequest;

  try {
    body = (await request.json()) as GddRequest;
  } catch {
    return Response.json({ error: "The request body must be valid JSON." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const concept = typeof body.concept === "string" ? body.concept.trim() : "";
  const genre = typeof body.genre === "string" ? body.genre.trim() : "";
  const platform = typeof body.platform === "string" ? body.platform.trim() : "";
  const audience = typeof body.audience === "string" ? body.audience.trim() : "";
  const documentStyle = typeof body.documentStyle === "string" ? body.documentStyle.trim() : "";
  const projectStage = typeof body.projectStage === "string" ? body.projectStage.trim() : "";
  const teamSize = typeof body.teamSize === "string" ? body.teamSize.trim() : "";
  const visualDirectionNotes = sanitizeStylized3DNotes(body.visualDirection, 800);
  const visualDirection = lockedArtDirectionWithNotes(visualDirectionNotes);

  if (title.length < 2 || title.length > 100) {
    return Response.json({ error: "Enter a game title between 2 and 100 characters." }, { status: 400 });
  }

  if (concept.length < 30 || concept.length > 3500) {
    return Response.json(
      { error: "Describe the game concept in 30 to 3,500 characters." },
      { status: 400 },
    );
  }

  if (genre.length < 2 || genre.length > 100 || audience.length > 180 || visualDirectionNotes.length > 800) {
    return Response.json({ error: "One of the text fields is missing or too long." }, { status: 400 });
  }

  if (!isAllowed(platform, ALLOWED_PLATFORMS)) {
    return Response.json({ error: "Select a valid target platform." }, { status: 400 });
  }
  if (!isAllowed(documentStyle, ALLOWED_STYLES)) {
    return Response.json({ error: "Select a valid document style." }, { status: 400 });
  }
  if (!isAllowed(projectStage, ALLOWED_STAGES)) {
    return Response.json({ error: "Select a valid project stage." }, { status: 400 });
  }
  if (!isAllowed(teamSize, ALLOWED_TEAM_SIZES)) {
    return Response.json({ error: "Select a valid team size." }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error:
          "Final GDD AI enrichment is not connected. Add GROQ_API_KEY to .env.local and restart the server.",
      },
      { status: 503 },
    );
  }

  const model = process.env.GROQ_FAST_MODEL?.trim() || process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-20b";

  // Groq's free/on-demand TPM allowance counts the prompt plus the requested
  // completion budget. The old 6,500-token output budget pushed this request
  // above an 8,000 TPM limit before generation even started.
  const configuredBudget = Number.parseInt(process.env.GROQ_GDD_MAX_TOKENS || "", 10);
  const primaryTokenBudget = Number.isFinite(configuredBudget)
    ? Math.min(4200, Math.max(2200, configuredBudget))
    : 3600;
  const retryTokenBudget = Math.min(2400, primaryTokenBudget);

  const compactProjectInput = JSON.stringify({
    task: "Create a concise, presentation-ready GDD using every schema field.",
    title,
    concept,
    genre,
    platform,
    audience: audience || "Infer from the concept",
    documentStyle,
    projectStage,
    teamSize,
    artStyle: LOCKED_ART_STYLE,
    visualDirection,
    writingLimits: {
      prose: "1-3 concise sentences per prose field",
      listItems: "one concise sentence per item",
      scope: "specific, coherent, feasible, and free of repetition",
    },
  });

  type GddResponseMode = "json-object" | "plain" | "strict-schema";

  const requestGdd = async (
    maxCompletionTokens: number,
    compressed: boolean,
    mode: GddResponseMode = "json-object",
  ) => {
    const requestBody: Record<string, unknown> = {
      model,
      temperature: 0.25,
      max_completion_tokens: maxCompletionTokens,
      messages: [
        {
          role: "system",
          content: compressed
            ? `${GDD_SYSTEM_PROMPT} Keep every field very concise. Prefer completeness over elaboration.`
            : GDD_SYSTEM_PROMPT,
        },
        { role: "user", content: compactProjectInput },
      ],
    };

    // GDD generation defaults to JSON Object Mode instead of provider-enforced
    // strict schema validation. The route already has a comprehensive normalizer
    // that safely repairs strings, arrays, nested objects, omitted fields, and
    // malformed sections. Strict schema validation caused otherwise useful GDDs
    // to be rejected before GameForge could repair them. It can still be enabled
    // deliberately for diagnostics through GROQ_GDD_STRICT_SCHEMA=true.
    if (mode === "strict-schema" && supportsStrictSchema(model)) {
      requestBody.response_format = {
        type: "json_schema",
        json_schema: {
          name: "game_design_document",
          strict: true,
          schema: GDD_JSON_SCHEMA,
        },
      };
    } else if (mode === "json-object") {
      requestBody.response_format = { type: "json_object" };
    }

    return fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
  };

  try {
    const strictSchemaRequested =
      process.env.GROQ_GDD_STRICT_SCHEMA?.trim().toLowerCase() === "true";

    let groqResponse = await requestGdd(
      primaryTokenBudget,
      false,
      strictSchemaRequested ? "strict-schema" : "json-object",
    );
    let payload = (await groqResponse.json().catch(() => ({}))) as GroqResponse;

    const firstProviderMessage = payload.error?.message || "";
    const exceededTpmByRequestSize =
      groqResponse.status === 429 &&
      /request too large|tokens per minute|\bTPM\b/i.test(firstProviderMessage);

    // Retry once with a smaller output reservation. The normalizer below safely
    // fills any omitted detail, so a compact response is preferable to failure.
    if (exceededTpmByRequestSize && retryTokenBudget < primaryTokenBudget) {
      groqResponse = await requestGdd(retryTokenBudget, true, "json-object");
      payload = (await groqResponse.json().catch(() => ({}))) as GroqResponse;
    }

    const providerValidationMessage = payload.error?.message || "";
    const providerValidationCode = `${payload.error?.code || ""} ${payload.error?.type || ""}`;
    const providerJsonValidationFailed =
      !groqResponse.ok &&
      /failed_generation|failed to validate json|jsonschema|does not validate|expected .* got|invalid json|json validation/i.test(
        `${providerValidationCode} ${providerValidationMessage}`,
      );

    // If Groq rejects its own JSON before returning content, retry without a
    // response_format constraint. GameForge then extracts the first JSON object
    // and normalizes every field locally. This avoids blocking the entire GDD
    // because of one provider-side JSON validation decision.
    if (providerJsonValidationFailed) {
      groqResponse = await requestGdd(retryTokenBudget, true, "plain");
      payload = (await groqResponse.json().catch(() => ({}))) as GroqResponse;
    }

    if (!groqResponse.ok) {
      const providerMessage = payload.error?.message;
      const providerCode = `${payload.error?.code || ""} ${payload.error?.type || ""}`;
      const isJsonGenerationFailure =
        /failed_generation|failed to validate json|jsonschema|does not validate|invalid json|json validation/i.test(
          `${providerCode} ${providerMessage || ""}`,
        );

      // JSON-shape failures are non-fatal because GameForge has enough validated
      // project context to construct a complete, coherent GDD locally. Authentication,
      // model-access, and rate-limit failures still surface normally.
      if (isJsonGenerationFailure) {
        const document = normalizeGddDocument({}, {
          title,
          concept,
          genre,
          platform,
          audience,
          documentStyle,
          projectStage,
          teamSize,
          visualDirection,
        });
        const cover = await createCoverImage(document.coverImagePrompt);

        return Response.json(
          {
            document,
            sections: documentToSections(document),
            pageCount: 16,
            coverImageDataUrl: cover.coverImageDataUrl,
            coverImageError: cover.coverImageError,
            generationWarning:
              "Groq could not validate its JSON response, so GameForge completed the GDD using the validated project brief and built-in production defaults.",
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
      const isTpmError = /request too large|tokens per minute|\bTPM\b/i.test(providerMessage || "");
      const safeMessage =
        groqResponse.status === 401
          ? "The Groq API key is invalid. Check GROQ_API_KEY in .env.local."
          : groqResponse.status === 403
            ? "This Groq project cannot use the selected model. Check GROQ_FAST_MODEL or GROQ_MODEL."
            : groqResponse.status === 429 && isTpmError
              ? "The GDD request still exceeds this Groq account's token-per-minute allowance. Set GROQ_GDD_MAX_TOKENS=2200 in .env.local, restart the server, and generate again."
              : groqResponse.status === 429
                ? "The Groq rate limit is temporarily reached. Wait briefly and generate again, or enable paid API usage."
                : providerMessage || "Groq could not generate the GDD.";
      return Response.json({ error: safeMessage }, { status: 502 });
    }

    const outputText = payload.choices?.[0]?.message?.content?.trim();
    const context: GddContext = {
      title,
      concept,
      genre,
      platform,
      audience,
      documentStyle,
      projectStage,
      teamSize,
      visualDirection,
    };

    const document = outputText
      ? parseGddDocument(outputText, context)
      : normalizeGddDocument({}, context);
    const generationWarning = outputText
      ? null
      : "Groq returned an empty response, so GameForge completed the GDD from the validated project brief.";

    const cover = await createCoverImage(document.coverImagePrompt);

    return Response.json(
      {
        document,
        sections: documentToSections(document),
        pageCount: 16,
        coverImageDataUrl: cover.coverImageDataUrl,
        coverImageError: cover.coverImageError,
        generationWarning,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("GDD generation failed:", error);
    return Response.json(
      {
        error:
          error instanceof Error && error.message
            ? error.message
            : "The GDD could not be generated. Please try again.",
      },
      { status: 500 },
    );
  }
}
