import type {
  CreateGameBlueprintRequest,
  GameBlueprint,
} from "@/app/types/blueprint";
import {
  LOCKED_ART_DIRECTION,
  LOCKED_ART_STYLE,
  LOCKED_CHARACTER_DIRECTION,
  LOCKED_WORLD_DIRECTION,
  buildStylized3DPrompt,
} from "@/lib/art-direction/stylized-3d";

import { GroqApiError } from "./groq";
import { generateSection } from "./sections";

import {
  CHARACTER_SYSTEM_PROMPT,
  OVERVIEW_GAMEPLAY_SYSTEM_PROMPT,
  STORY_WORLD_SYSTEM_PROMPT,
  SYSTEMS_SYSTEM_PROMPT,
} from "./sectionPrompts";

import {
  type GeneratedBlueprint,
  isGeneratedBlueprint,
} from "./blueprintValidator";

type OverviewGameplaySection = Pick<
  GeneratedBlueprint,
  "overview" | "gameplay"
>;

type StoryWorldSection = Pick<
  GeneratedBlueprint,
  "story" | "world"
>;

type CharacterSection = Pick<
  GeneratedBlueprint,
  "characters" | "enemies" | "quests"
>;

type SystemsSection = Pick<
  GeneratedBlueprint,
  | "progression"
  | "artDirection"
  | "audioDirection"
  | "technicalPlan"
  | "roadmap"
>;

function buildGameContext(
  request: CreateGameBlueprintRequest,
): string {
  return `
Create original game-design content based on this request.

GAME IDEA
${request.idea}

GENRE
${request.genre}

PLATFORM
${request.platform}

ART STYLE
${LOCKED_ART_STYLE}
${LOCKED_ART_DIRECTION}

TARGET AUDIENCE
${request.audience}

GAME MODE
Single Player

QUALITY LEVEL
${request.quality}

PERSPECTIVE
${request.perspective}

CREATIVE TWIST
${
  request.creativeTwist
    ? "Include one bold creative twist while preserving the original game identity."
    : "Stay closely aligned with the original idea. Do not force an extra twist."
}

Keep all sections consistent with the same game concept.

Return only the requested valid JSON object.
`;
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function hasProperties(
  value: unknown,
  properties: string[],
): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return properties.every((property) => property in value);
}

function isOverviewGameplaySection(
  value: unknown,
): value is OverviewGameplaySection {
  return hasProperties(value, [
    "overview",
    "gameplay",
  ]);
}

function isStoryWorldSection(
  value: unknown,
): value is StoryWorldSection {
  return hasProperties(value, [
    "story",
    "world",
  ]);
}

function isCharacterSection(
  value: unknown,
): value is CharacterSection {
  return hasProperties(value, [
    "characters",
    "enemies",
    "quests",
  ]);
}

function isSystemsSection(
  value: unknown,
): value is SystemsSection {
  return hasProperties(value, [
    "progression",
    "artDirection",
    "audioDirection",
    "technicalPlan",
    "roadmap",
  ]);
}

async function generateWithRetry<T>(
  sectionName: string,
  systemPrompt: string,
  userPrompt: string,
  validator: (value: unknown) => value is T,
  maxCompletionTokens: number,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt += 1
  ) {
    try {
      const result = await generateSection<unknown>(
        systemPrompt,
        userPrompt,
        maxCompletionTokens,
      );

      if (validator(result)) {
        return result;
      }

      console.error(
        `${sectionName} failed validation on attempt ${attempt}:`,
        result,
      );

      lastError = new Error(
        `${sectionName} returned incomplete JSON.`,
      );
    } catch (error) {
      console.error(
        `${sectionName} generation failed on attempt ${attempt}:`,
        error,
      );

      lastError = error;

      if (
        error instanceof GroqApiError &&
        error.status === 429
      ) {
        throw error;
      }
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * attempt),
      );
    }
  }

   console.error(
  `${sectionName} failed after ${maxAttempts} attempts:`,
  lastError,
);

throw new GroqApiError(
  `The AI could not generate the ${sectionName} section after ${maxAttempts} attempts.`,
  502,
);
}

export async function generateBlueprint(
  request: CreateGameBlueprintRequest,
): Promise<GameBlueprint> {
  const gameContext = buildGameContext(request);

  const overviewGameplay =
    await generateWithRetry<OverviewGameplaySection>(
      "overview and gameplay",
      OVERVIEW_GAMEPLAY_SYSTEM_PROMPT,
      gameContext,
      isOverviewGameplaySection,
      1800,
    );

  const storyWorld =
    await generateWithRetry<StoryWorldSection>(
      "story and world",
      STORY_WORLD_SYSTEM_PROMPT,
      `
${gameContext}

Use this established game overview for consistency:

${JSON.stringify(
  overviewGameplay.overview,
  null,
  2,
)}
`,
      isStoryWorldSection,
      2200,
    );

  const characterContent =
    await generateWithRetry<CharacterSection>(
      "characters, enemies, and quests",
      CHARACTER_SYSTEM_PROMPT,
      `
${gameContext}

Use this established overview and world:

OVERVIEW
${JSON.stringify(
  overviewGameplay.overview,
  null,
  2,
)}

WORLD
${JSON.stringify(
  storyWorld.world,
  null,
  2,
)}
`,
      isCharacterSection,
      2600,
    );

  const systemsContent =
    await generateWithRetry<SystemsSection>(
      "progression and production systems",
      SYSTEMS_SYSTEM_PROMPT,
      `
${gameContext}

Use the following established game information for consistency:

OVERVIEW
${JSON.stringify(
  overviewGameplay.overview,
  null,
  2,
)}

GAMEPLAY
${JSON.stringify(
  overviewGameplay.gameplay,
  null,
  2,
)}

WORLD
${JSON.stringify(
  storyWorld.world,
  null,
  2,
)}

CHARACTERS
${JSON.stringify(
  characterContent.characters,
  null,
  2,
)}
`,
      isSystemsSection,
      2600,
    );

  const generatedBlueprint: unknown = {
    ...overviewGameplay,
    ...storyWorld,
    ...characterContent,
    ...systemsContent,
  };

  if (!isGeneratedBlueprint(generatedBlueprint)) {
    console.error(
      "Merged blueprint failed final validation:",
      generatedBlueprint,
    );

    throw new GroqApiError(
      "The AI generated one or more incomplete blueprint sections. Please try again.",
      502,
    );
  }

  return {
    ...generatedBlueprint,
    overview: {
      ...generatedBlueprint.overview,
      artStyle: LOCKED_ART_STYLE,
      gameMode: "Single Player",
    },
    world: {
      ...generatedBlueprint.world,
      imagePrompt: buildStylized3DPrompt(generatedBlueprint.world.imagePrompt, "playable world concept"),
      locations: generatedBlueprint.world.locations.map((location) => ({
        ...location,
        imagePrompt: buildStylized3DPrompt(location.imagePrompt, "playable location concept"),
      })),
    },
    characters: generatedBlueprint.characters.map((character) => ({
      ...character,
      imagePrompt: buildStylized3DPrompt(character.imagePrompt, "full-body game character reference"),
    })),
    enemies: generatedBlueprint.enemies.map((enemy) => ({
      ...enemy,
      imagePrompt: buildStylized3DPrompt(enemy.imagePrompt, "game enemy reference"),
    })),
    artDirection: {
      ...generatedBlueprint.artDirection,
      visualStyle: LOCKED_ART_DIRECTION,
      characterStyle: LOCKED_CHARACTER_DIRECTION,
      environmentStyle: LOCKED_WORLD_DIRECTION,
      coverArtPrompt: buildStylized3DPrompt(generatedBlueprint.artDirection.coverArtPrompt, "commercial game key art"),
      logoPrompt: buildStylized3DPrompt(generatedBlueprint.artDirection.logoPrompt, "stylized 3D game logo treatment"),
    },
    generatedAt: new Date().toISOString(),
  };
}