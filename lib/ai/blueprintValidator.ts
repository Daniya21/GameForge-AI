import type { GameBlueprint } from "@/app/types/blueprint";

export type GeneratedBlueprint = Omit<
  GameBlueprint,
  "generatedAt"
>;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string")
  );
}

function hasRequiredString(
  value: UnknownRecord,
  field: string,
): boolean {
  return isNonEmptyString(value[field]);
}

function hasStringArray(
  value: UnknownRecord,
  field: string,
): boolean {
  return isStringArray(value[field]);
}

function isBlueprintOverview(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasRequiredString(value, "title") &&
    hasRequiredString(value, "tagline") &&
    hasRequiredString(value, "highConcept") &&
    hasRequiredString(value, "genre") &&
    hasRequiredString(value, "platform") &&
    hasStringArray(value, "uniqueSellingPoints")
  );
}

function isBlueprintGameplay(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasRequiredString(value, "playerFantasy") &&
    hasStringArray(value, "coreLoop") &&
    hasStringArray(value, "mainMechanics") &&
    hasStringArray(value, "objectives")
  );
}

function isBlueprintStory(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasRequiredString(value, "premise") &&
    hasRequiredString(value, "playerRole") &&
    hasRequiredString(value, "mainConflict") &&
    hasStringArray(value, "importantChoices")
  );
}

function isBlueprintLocation(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasRequiredString(value, "name") &&
    hasRequiredString(value, "description")
  );
}

function isBlueprintFaction(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasRequiredString(value, "name") &&
    hasRequiredString(value, "description")
  );
}

function isBlueprintWorld(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasRequiredString(value, "name") &&
    hasRequiredString(value, "setting") &&
    hasRequiredString(value, "atmosphere") &&
    hasStringArray(value, "worldRules") &&
    Array.isArray(value.locations) &&
    value.locations.every(isBlueprintLocation) &&
    Array.isArray(value.factions) &&
    value.factions.every(isBlueprintFaction) &&
    hasStringArray(value, "hazards") &&
    hasStringArray(value, "secrets")
  );
}

function isBlueprintCharacter(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasRequiredString(value, "name") &&
    hasRequiredString(value, "role") &&
    hasRequiredString(value, "personality") &&
    hasStringArray(value, "abilities")
  );
}

function isBlueprintEnemy(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasRequiredString(value, "name") &&
    hasRequiredString(value, "type") &&
    hasRequiredString(value, "description") &&
    hasStringArray(value, "abilities") &&
    hasStringArray(value, "rewards")
  );
}

function isBlueprintQuest(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasRequiredString(value, "title") &&
    hasRequiredString(value, "type") &&
    hasRequiredString(value, "description") &&
    hasStringArray(value, "objectives") &&
    hasStringArray(value, "rewards")
  );
}

function isBlueprintProgression(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasRequiredString(value, "levelingSystem") &&
    hasRequiredString(value, "upgradeSystem") &&
    hasStringArray(value, "skills") &&
    hasStringArray(value, "unlockableAbilities") &&
    hasStringArray(value, "equipment") &&
    hasStringArray(value, "currencies")
  );
}

function isBlueprintArtDirection(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasRequiredString(value, "visualStyle") &&
    hasRequiredString(value, "lightingStyle") &&
    hasStringArray(value, "colorPalette")
  );
}

function isBlueprintAudioDirection(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasRequiredString(value, "musicStyle") &&
    hasStringArray(value, "ambience") &&
    hasStringArray(value, "combatSounds") &&
    hasStringArray(value, "environmentSounds")
  );
}

function isBlueprintTechnicalPlan(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasRequiredString(value, "recommendedEngine") &&
    hasStringArray(value, "requiredSystems") &&
    hasStringArray(value, "enemyAiRequirements") &&
    hasStringArray(value, "performanceTargets") &&
    hasStringArray(
      value,
      "recommendedDevelopmentOrder",
    )
  );
}

function isBlueprintRoadmap(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasStringArray(value, "prototype") &&
    hasStringArray(value, "verticalSlice") &&
    hasStringArray(value, "alpha") &&
    hasStringArray(value, "beta") &&
    hasStringArray(value, "finalPolish") &&
    hasStringArray(value, "majorRisks")
  );
}

export function isGeneratedBlueprint(
  value: unknown,
): value is GeneratedBlueprint {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isBlueprintOverview(value.overview) &&
    isBlueprintGameplay(value.gameplay) &&
    isBlueprintStory(value.story) &&
    isBlueprintWorld(value.world) &&
    Array.isArray(value.characters) &&
    value.characters.length > 0 &&
    value.characters.every(isBlueprintCharacter) &&
    Array.isArray(value.enemies) &&
    value.enemies.length > 0 &&
    value.enemies.every(isBlueprintEnemy) &&
    Array.isArray(value.quests) &&
    value.quests.length > 0 &&
    value.quests.every(isBlueprintQuest) &&
    isBlueprintProgression(value.progression) &&
    isBlueprintArtDirection(value.artDirection) &&
    isBlueprintAudioDirection(value.audioDirection) &&
    isBlueprintTechnicalPlan(value.technicalPlan) &&
    isBlueprintRoadmap(value.roadmap)
  );
}