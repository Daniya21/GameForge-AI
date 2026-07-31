"use client";

import type {
  DesignStudioSectionName,
  GameProject,
  ProjectReadiness,
  StoredDesignResult,
} from "@/app/types/game-project";
import type { GameBuildBrief, GameRuntimeContent, WorldLayout } from "@/app/types/game";
import {
  LOCKED_ART_DIRECTION,
  LOCKED_ART_STYLE,
  LOCKED_CHARACTER_DIRECTION,
  LOCKED_WORLD_DIRECTION,
  buildStylized3DPrompt,
} from "@/lib/art-direction/stylized-3d";
import {
  projectMediaUrl,
  queueProjectMediaDataUrl,
  resolveProjectMediaDataUrl,
} from "@/lib/game-assets/local-media-store";

export type ProjectReferenceImage = {
  role: "player" | "vehicle" | "enemy" | "environment";
  dataUrl: string;
  name: string;
};

export const GAME_PROJECT_STORAGE_KEY = "gameforge.activeProject.v1";
export const GAME_PROJECTS_STORAGE_KEY = "gameforge.projects.v1";
export const ACTIVE_GAME_PROJECT_ID_KEY = "gameforge.activeProjectId.v1";
export const GAME_PROJECT_EVENT = "gameforge-project-updated";
export const GAME_PROJECT_LIST_EVENT = "gameforge-project-list-updated";

const SECTION_LABELS: Record<DesignStudioSectionName, string> = {
  story: "Story",
  characters: "Characters",
  world: "World",
  quests: "Quests",
  dialogue: "Dialogue",
  mentor: "AI Mentor",
  gdd: "GDD",
};

function now() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}

const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp);base64,/i;
const STORAGE_HISTORY_LIMITS = { characters: 8, quests: 8, dialogue: 8 };

type MediaWrite = {
  id: string;
  dataUrl: string;
  label?: string;
  role?: string;
};

function mediaRoleForPath(path: string[]) {
  const joined = path.join(".").toLowerCase();
  if (joined.includes("world") || joined.includes("environment")) return "environment";
  if (joined.includes("enemy") || joined.includes("guard")) return "enemy";
  if (joined.includes("character") || joined.includes("avatar") || joined.includes("player")) return "player";
  return "reference";
}

function externalizeEmbeddedImages(
  value: unknown,
  projectId: string,
  path: string[] = [],
  writes: MediaWrite[] = [],
): { value: unknown; writes: MediaWrite[]; changed: boolean } {
  if (typeof value === "string") {
    if (!IMAGE_DATA_URL.test(value)) return { value, writes, changed: false };
    const id = `${projectId}-${makeId("media")}`;
    writes.push({
      id,
      dataUrl: value,
      label: path[path.length - 1] || "Generated image",
      role: mediaRoleForPath(path),
    });
    return { value: projectMediaUrl(id), writes, changed: true };
  }
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item, index) => {
      const result = externalizeEmbeddedImages(item, projectId, [...path, String(index)], writes);
      changed ||= result.changed;
      return result.value;
    });
    return { value: changed ? next : value, writes, changed };
  }
  if (!value || typeof value !== "object" || value instanceof Date || value instanceof Blob) {
    return { value, writes, changed: false };
  }
  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const result = externalizeEmbeddedImages(child, projectId, [...path, key], writes);
    changed ||= result.changed;
    next[key] = result.value;
  }
  return { value: changed ? next : value, writes, changed };
}

function queueMediaWrites(writes: MediaWrite[]) {
  for (const item of writes) {
    void queueProjectMediaDataUrl(item.id, item.dataUrl, { label: item.label, role: item.role }).catch((error) => {
      console.warn("GameForge could not move a generated image into IndexedDB.", error);
    });
  }
}

function stripAnyRemainingDataUrls(value: unknown): unknown {
  if (typeof value === "string") return IMAGE_DATA_URL.test(value) ? null : value;
  if (Array.isArray(value)) return value.map(stripAnyRemainingDataUrls);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, stripAnyRemainingDataUrls(child)]));
}

function compactProjectHistory(project: GameProject): GameProject {
  return {
    ...project,
    designStudio: {
      ...project.designStudio,
      characters: project.designStudio.characters.slice(-STORAGE_HISTORY_LIMITS.characters),
      quests: project.designStudio.quests.slice(-STORAGE_HISTORY_LIMITS.quests),
      dialogue: project.designStudio.dialogue.slice(-STORAGE_HISTORY_LIMITS.dialogue),
    },
  };
}

function compactLegacyGameforgeStorage() {
  if (typeof window === "undefined") return;
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (!key || key === GAME_PROJECT_STORAGE_KEY || key === GAME_PROJECTS_STORAGE_KEY) continue;
    if (key !== "gameBlueprint" && !key.startsWith("gameforge.")) continue;
    const raw = window.localStorage.getItem(key);
    if (!raw || raw.length < 500_000 || !raw.includes("data:image/")) continue;
    try {
      const compacted = JSON.stringify(stripAnyRemainingDataUrls(JSON.parse(raw)));
      window.localStorage.setItem(key, compacted);
    } catch {
      // Leave unrelated user data untouched when it cannot be safely compacted.
    }
  }
}

function readStoredProjects(): GameProject[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(GAME_PROJECTS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isGameProject).map((project) => lockProjectArtDirection(project));
  } catch {
    return [];
  }
}

function persistProjectCollection(projects: GameProject[]): boolean {
  const deduped = Array.from(new Map(projects.map((project) => [project.id, compactProjectHistory(project)])).values())
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  try {
    window.localStorage.setItem(GAME_PROJECTS_STORAGE_KEY, JSON.stringify(deduped));
    window.dispatchEvent(new CustomEvent(GAME_PROJECT_LIST_EVENT, { detail: deduped }));
    return true;
  } catch (error) {
    const quotaError = error instanceof DOMException && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED");
    if (!quotaError) {
      console.warn("GameForge could not save the project library.", error);
      return false;
    }
  }

  compactLegacyGameforgeStorage();
  try {
    window.localStorage.setItem(GAME_PROJECTS_STORAGE_KEY, JSON.stringify(deduped.slice(0, 12)));
    window.dispatchEvent(new CustomEvent(GAME_PROJECT_LIST_EVENT, { detail: deduped.slice(0, 12) }));
    return true;
  } catch (error) {
    console.warn("GameForge project storage is full. The current generated result remains available on this page.", error);
    return false;
  }
}

function migrateLegacyActiveProject(): GameProject | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(GAME_PROJECT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isGameProject(parsed)) return null;
    const project = lockProjectArtDirection(parsed);
    window.localStorage.setItem(ACTIVE_GAME_PROJECT_ID_KEY, project.id);
    persistProjectCollection([project]);
    window.localStorage.removeItem(GAME_PROJECT_STORAGE_KEY);
    return project;
  } catch {
    return null;
  }
}

function persistProject(project: GameProject): boolean {
  if (typeof window === "undefined") return false;
  const projects = readStoredProjects();
  const next = [...projects.filter((item) => item.id !== project.id), project];
  window.localStorage.setItem(ACTIVE_GAME_PROJECT_ID_KEY, project.id);
  return persistProjectCollection(next);
}

export function createEmptyGameProject(title = "Untitled Game Project"): GameProject {
  const timestamp = now();
  return {
    schemaVersion: 1,
    id: makeId("project"),
    title,
    summary: "",
    genre: "",
    platform: "Web",
    artStyle: LOCKED_ART_STYLE,
    audience: "Teen",
    mode: "Single Player",
    createdAt: timestamp,
    updatedAt: timestamp,
    designStudio: {
      story: null,
      characters: [],
      world: null,
      quests: [],
      dialogue: [],
      mentor: null,
      gdd: null,
      blueprint: null,
    },
    build: {
      status: "designing",
      selectedTemplate: null,
      lastBuild: null,
      warning: "",
      provider: "",
      updatedAt: null,
    },
  };
}

function isGameProject(value: unknown): value is GameProject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.schemaVersion === 1 && typeof record.id === "string" && typeof record.title === "string";
}

function lockBlueprintArtDirection(blueprint: GameProject["designStudio"]["blueprint"]) {
  if (!blueprint) return null;
  return {
    ...blueprint,
    overview: {
      ...blueprint.overview,
      artStyle: LOCKED_ART_STYLE,
      gameMode: "Single Player",
    },
    artDirection: {
      ...blueprint.artDirection,
      visualStyle: LOCKED_ART_DIRECTION,
      characterStyle: LOCKED_CHARACTER_DIRECTION,
      environmentStyle: LOCKED_WORLD_DIRECTION,
      coverArtPrompt: buildStylized3DPrompt(blueprint.artDirection.coverArtPrompt, "commercial game key art"),
      logoPrompt: buildStylized3DPrompt(blueprint.artDirection.logoPrompt, "stylized 3D game logo treatment"),
    },
    world: {
      ...blueprint.world,
      imagePrompt: buildStylized3DPrompt(blueprint.world.imagePrompt, "playable world concept"),
      locations: blueprint.world.locations.map((location) => ({
        ...location,
        imagePrompt: buildStylized3DPrompt(location.imagePrompt, "playable location concept"),
      })),
    },
    characters: blueprint.characters.map((character) => ({
      ...character,
      imagePrompt: buildStylized3DPrompt(character.imagePrompt, "full-body game character reference"),
    })),
    enemies: blueprint.enemies.map((enemy) => ({
      ...enemy,
      imagePrompt: buildStylized3DPrompt(enemy.imagePrompt, "game enemy reference"),
    })),
  };
}

function lockProjectArtDirection(project: GameProject): GameProject {
  const lastBuild = project.build.lastBuild
    ? {
        ...project.build.lastBuild,
        artStyle: LOCKED_ART_STYLE,
        mode: "Single Player",
      }
    : null;

  return {
    ...project,
    artStyle: LOCKED_ART_STYLE,
    mode: "Single Player",
    designStudio: {
      ...project.designStudio,
      blueprint: lockBlueprintArtDirection(project.designStudio.blueprint),
    },
    build: {
      ...project.build,
      lastBuild,
    },
  };
}

export function readAllGameProjects(): GameProject[] {
  if (typeof window === "undefined") return [];
  const projects = readStoredProjects();
  if (projects.length) return projects;
  const migrated = migrateLegacyActiveProject();
  return migrated ? [migrated] : [];
}

export function readActiveGameProject(): GameProject | null {
  if (typeof window === "undefined") return null;
  const projects = readAllGameProjects();
  if (!projects.length) return null;
  const activeId = window.localStorage.getItem(ACTIVE_GAME_PROJECT_ID_KEY);
  const selected = projects.find((project) => project.id === activeId) || projects[0];
  const externalized = externalizeEmbeddedImages(selected, selected.id);
  const safeProject = lockProjectArtDirection(externalized.value as GameProject);
  const styleWasMigrated = selected.artStyle !== LOCKED_ART_STYLE || selected.mode !== "Single Player";
  if (externalized.changed || styleWasMigrated) {
    queueMediaWrites(externalized.writes);
    persistProject(safeProject);
  }
  if (activeId !== safeProject.id) window.localStorage.setItem(ACTIVE_GAME_PROJECT_ID_KEY, safeProject.id);
  return safeProject;
}

export function getOrCreateActiveGameProject(title?: string): GameProject {
  const existing = readActiveGameProject();
  if (existing) return existing;
  return createAndActivateGameProject(title || "Untitled Game Project");
}

export function writeActiveGameProject(project: GameProject): GameProject {
  if (typeof window === "undefined") return project;
  const next = lockProjectArtDirection({ ...project, updatedAt: now() });
  const externalized = externalizeEmbeddedImages(next, next.id);
  const safeProject = externalized.value as GameProject;
  queueMediaWrites(externalized.writes);
  persistProject(safeProject);
  window.dispatchEvent(new CustomEvent(GAME_PROJECT_EVENT, { detail: safeProject }));
  return safeProject;
}

export function createAndActivateGameProject(title = "Untitled Game Project") {
  const project = createEmptyGameProject(title.trim() || "Untitled Game Project");
  return writeActiveGameProject(project);
}

export function switchActiveGameProject(projectId: string): GameProject | null {
  if (typeof window === "undefined") return null;
  const project = readAllGameProjects().find((item) => item.id === projectId) || null;
  if (!project) return null;
  window.localStorage.setItem(ACTIVE_GAME_PROJECT_ID_KEY, project.id);
  window.dispatchEvent(new CustomEvent(GAME_PROJECT_EVENT, { detail: project }));
  return project;
}

export function duplicateGameProject(projectId: string): GameProject | null {
  const source = readAllGameProjects().find((item) => item.id === projectId);
  if (!source) return null;
  const timestamp = now();
  const duplicate: GameProject = {
    ...source,
    id: makeId("project"),
    title: `${source.title} Copy`,
    createdAt: timestamp,
    updatedAt: timestamp,
    designStudio: {
      ...source.designStudio,
      characters: [...source.designStudio.characters],
      quests: [...source.designStudio.quests],
      dialogue: [...source.designStudio.dialogue],
    },
  };
  return writeActiveGameProject(duplicate);
}

export function deleteGameProject(projectId: string): GameProject | null {
  if (typeof window === "undefined") return null;
  const remaining = readAllGameProjects().filter((item) => item.id !== projectId);
  persistProjectCollection(remaining);
  if (!remaining.length) {
    window.localStorage.removeItem(ACTIVE_GAME_PROJECT_ID_KEY);
    return createAndActivateGameProject();
  }
  const activeId = window.localStorage.getItem(ACTIVE_GAME_PROJECT_ID_KEY);
  const next = remaining.find((item) => item.id === activeId) || remaining[0];
  window.localStorage.setItem(ACTIVE_GAME_PROJECT_ID_KEY, next.id);
  window.dispatchEvent(new CustomEvent(GAME_PROJECT_EVENT, { detail: next }));
  return next;
}

export function resetActiveGameProject(title?: string) {
  return createAndActivateGameProject(title || "Untitled Game Project");
}

export function updateActiveGameProject(
  updater: (project: GameProject) => GameProject,
): GameProject {
  const current = getOrCreateActiveGameProject();
  return writeActiveGameProject(updater(current));
}

export function saveDesignStudioSection<T>(
  section: DesignStudioSectionName,
  input: Record<string, unknown>,
  result: T,
): GameProject {
  return updateActiveGameProject((project) => {
    const timestamp = now();
    const stored: StoredDesignResult<T> = {
      id: makeId(section),
      input: { ...input, artStyle: LOCKED_ART_STYLE },
      result,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const designStudio = { ...project.designStudio };
    if (section !== "gdd") designStudio.gdd = null;
    if (section === "characters") {
      designStudio.characters = [stored];
    } else if (section === "quests") {
      designStudio.quests = [...designStudio.quests, stored].slice(-12);
    } else if (section === "dialogue") {
      designStudio.dialogue = [...designStudio.dialogue, stored].slice(-12);
    } else if (section === "story") {
      designStudio.story = stored;
    } else if (section === "world") {
      designStudio.world = stored;
    } else if (section === "mentor") {
      designStudio.mentor = stored;
    } else {
      designStudio.gdd = stored;
    }

    const inferredTitle = inferProjectTitle(project, section, result);
    const inferredSummary = inferProjectSummary(project, section, input, result);
    const genre = project.genre || stringValue(input.genre);
    return {
      ...project,
      title: inferredTitle,
      summary: inferredSummary,
      genre,
      artStyle: LOCKED_ART_STYLE,
      mode: "Single Player",
      designStudio,
      build: { ...project.build, status: "designing" },
    };
  });
}

export function saveGeneratedBlueprint(blueprint: GameProject["designStudio"]["blueprint"]) {
  if (!blueprint) return getOrCreateActiveGameProject();
  const lockedBlueprint = lockBlueprintArtDirection(blueprint);
  if (!lockedBlueprint) return getOrCreateActiveGameProject();
  return updateActiveGameProject((project) => ({
    ...project,
    title: lockedBlueprint.overview.title || project.title,
    summary: lockedBlueprint.overview.highConcept || project.summary,
    genre: lockedBlueprint.overview.genre || project.genre,
    platform: lockedBlueprint.overview.platform || project.platform,
    artStyle: LOCKED_ART_STYLE,
    audience: lockedBlueprint.overview.targetAudience || project.audience,
    mode: "Single Player",
    designStudio: { ...project.designStudio, blueprint: lockedBlueprint },
  }));
}

export function saveProjectBuild(
  build: GameProject["build"]["lastBuild"],
  provider: string,
  warning = "",
) {
  if (!build) return getOrCreateActiveGameProject();
  return updateActiveGameProject((project) => ({
    ...project,
    title: build.title || project.title,
    summary: build.premise || project.summary,
    genre: build.genre || project.genre,
    platform: build.platform || project.platform,
    artStyle: LOCKED_ART_STYLE,
    audience: build.audience || project.audience,
    mode: "Single Player",
    build: {
      status: "ready",
      selectedTemplate: build.templateFamily,
      lastBuild: { ...build, artStyle: LOCKED_ART_STYLE, mode: "Single Player" },
      provider,
      warning,
      updatedAt: now(),
    },
  }));
}

export function projectReadiness(project: GameProject | null): ProjectReadiness {
  const sections = [
    { name: "story" as const, count: project?.designStudio.story ? 1 : 0 },
    { name: "characters" as const, count: project?.designStudio.characters.length ?? 0 },
    { name: "world" as const, count: project?.designStudio.world ? 1 : 0 },
    { name: "quests" as const, count: project?.designStudio.quests.length ?? 0 },
    { name: "dialogue" as const, count: project?.designStudio.dialogue.length ?? 0 },
    { name: "mentor" as const, count: project?.designStudio.mentor ? 1 : 0 },
  ].map((item) => ({
    ...item,
    label: SECTION_LABELS[item.name],
    ready: item.count > 0,
  }));
  const completed = sections.filter((section) => section.ready).length;
  return {
    completed,
    total: sections.length,
    percent: Math.round((completed / sections.length) * 100),
    sections,
  };
}


const BUILD_BRIEF_LIMITS = {
  concept: 640,
  field: 220,
  item: 150,
  context: 7600,
};

function cleanText(value: unknown, max = BUILD_BRIEF_LIMITS.field): string {
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim().slice(0, max);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function titleCaseKey(key: string) {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function flattenMeaningfulStrings(value: unknown, depth = 0, prefix = ""): string[] {
  if (depth > 3 || value === null || value === undefined) return [];
  if (typeof value === "string") {
    const cleaned = cleanText(value, BUILD_BRIEF_LIMITS.item);
    return cleaned.length >= 3 ? [prefix ? `${prefix}: ${cleaned}` : cleaned] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenMeaningfulStrings(item, depth + 1, prefix)).slice(0, 16);
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !/^(id|createdAt|updatedAt|raw|metadata)$/i.test(key) && !/(image|avatar|cover).*url|mediaref/i.test(key))
      .flatMap(([key, item]) => flattenMeaningfulStrings(item, depth + 1, titleCaseKey(key)))
      .slice(0, 20);
  }
  return [];
}

function findFirstByKeys(value: unknown, keys: string[], depth = 0): string {
  if (depth > 4 || !value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const direct = Object.entries(record).find(([candidate]) => candidate.toLowerCase() === key.toLowerCase());
    if (direct) {
      const text = cleanText(direct[1], BUILD_BRIEF_LIMITS.concept);
      if (text) return text;
    }
  }
  for (const child of Object.values(record)) {
    if (child && typeof child === "object") {
      const nested = findFirstByKeys(child, keys, depth + 1);
      if (nested) return nested;
    }
  }
  return "";
}

function unique(items: string[], max: number) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const cleaned = cleanText(item, BUILD_BRIEF_LIMITS.item);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (result.length >= max) break;
  }
  return result;
}

function referenceCandidates(project: GameProject) {
  const candidates: Array<{ role: ProjectReferenceImage["role"]; value: string; name: string }> = [];
  const characterRecords = project.designStudio.characters;

  const playerRecord = characterRecords[0];
  if (playerRecord) {
    const result = playerRecord.result as Record<string, unknown>;
    const value = typeof result.avatarDataUrl === "string" ? result.avatarDataUrl : "";
    const name = cleanText(result.characterName, 100) || "Player character";
    if (value) candidates.push({ role: "player", value, name });
  }

  const enemyRecord = characterRecords.find((stored, index) => {
    if (index === 0) return false;
    const input = stored.input || {};
    const result = stored.result as Record<string, unknown>;
    const identity = `${cleanText(input.archetype, 100)} ${cleanText(input.concept, 220)} ${cleanText(result.characterName, 100)} ${cleanText(result.summary, 220)}`.toLowerCase();
    return /enemy|villain|guard|security|antagonist|hostile|monster|boss|rival/.test(identity);
  });
  if (enemyRecord) {
    const result = enemyRecord.result as Record<string, unknown>;
    const value = typeof result.avatarDataUrl === "string" ? result.avatarDataUrl : "";
    const name = cleanText(result.characterName, 100) || "Enemy character";
    if (value) candidates.push({ role: "enemy", value, name });
  }

  const worldResult = project.designStudio.world?.result as Record<string, unknown> | undefined;
  const worldValue = typeof worldResult?.worldImageDataUrl === "string" ? worldResult.worldImageDataUrl : "";
  if (worldValue) candidates.push({ role: "environment", value: worldValue, name: `${project.title} world reference` });
  return candidates;
}

export function projectReferenceImages(project: GameProject): ProjectReferenceImage[] {
  return referenceCandidates(project)
    .filter((candidate) => IMAGE_DATA_URL.test(candidate.value))
    .map((candidate) => ({ role: candidate.role, dataUrl: candidate.value, name: candidate.name }));
}

export async function resolveProjectReferenceImages(project: GameProject): Promise<ProjectReferenceImage[]> {
  const resolved = await Promise.all(referenceCandidates(project).map(async (candidate) => {
    const dataUrl = await resolveProjectMediaDataUrl(candidate.value);
    return dataUrl ? { role: candidate.role, dataUrl, name: candidate.name } : null;
  }));
  return resolved.filter((item): item is ProjectReferenceImage => Boolean(item));
}

export function projectToBuildBrief(project: GameProject): GameBuildBrief {
  const story = project.designStudio.story?.result;
  const characters = project.designStudio.characters.map((item) => item.result);
  const world = project.designStudio.world?.result;
  const quests = project.designStudio.quests.map((item) => item.result);
  const dialogue = project.designStudio.dialogue.map((item) => item.result);
  const gdd = project.designStudio.gdd?.result;
  const blueprint = project.designStudio.blueprint;

  const highConcept = cleanText(
    project.summary
      || findFirstByKeys(gdd, ["highConcept", "overview", "executiveSummary", "summary"])
      || findFirstByKeys(blueprint, ["highConcept", "summary"])
      || findFirstByKeys(story, ["premise", "summary", "logline", "opening"]),
    BUILD_BRIEF_LIMITS.concept,
  ) || `A playable game based on ${project.title}.`;

  const playerRole = findFirstByKeys(gdd, ["playerFantasy", "playerRole", "corePlayerFantasy"])
    || findFirstByKeys(blueprint, ["playerFantasy", "playerRole"])
    || findFirstByKeys(characters[0], ["role", "archetype", "characterRole", "description"])
    || "The primary playable protagonist";

  const primaryGoal = findFirstByKeys(gdd, ["primaryGoal", "gameGoal", "objective", "coreObjective"])
    || findFirstByKeys(quests[0], ["questGoal", "objective", "summary", "questSummary"])
    || findFirstByKeys(story, ["goal", "objective", "conflict"])
    || "Complete the main mission and reach the final extraction or victory state.";

  const setting = findFirstByKeys(world, ["worldSummary", "setting", "worldDescription", "overview", "environment"])
    || findFirstByKeys(gdd, ["world", "setting", "environment"])
    || `${LOCKED_ART_STYLE} game world`;

  const mechanics = unique([
    ...flattenMeaningfulStrings(findFirstObjectByKeys(gdd, ["coreMechanics", "gameplayPillars", "mechanics"])),
    ...flattenMeaningfulStrings(findFirstObjectByKeys(blueprint, ["coreMechanics", "gameplay", "mechanics"])),
    ...flattenMeaningfulStrings(findFirstObjectByKeys(quests[0], ["objectives", "steps"])),
  ], 7);

  const keyCharacters = unique(characters.flatMap((character) => {
    const name = findFirstByKeys(character, ["characterName", "name", "title"]);
    const role = findFirstByKeys(character, ["role", "archetype", "characterRole"]);
    return [name && role ? `${name} — ${role}` : name || role];
  }), 6);

  const missionFlow = unique(quests.flatMap((quest) => {
    const title = findFirstByKeys(quest, ["questTitle", "title", "name"]);
    const goal = findFirstByKeys(quest, ["questGoal", "objective", "summary"]);
    const objectives = flattenMeaningfulStrings(findFirstObjectByKeys(quest, ["objectives", "steps"]));
    return [title && goal ? `${title}: ${goal}` : title || goal, ...objectives];
  }), 8);

  const sourceSections = projectReadiness(project).sections.filter((section) => section.ready).map((section) => section.label);

  return {
    title: cleanText(project.title.replace(/\s+Project$/i, ""), 100) || "Untitled Game",
    highConcept,
    playerRole: cleanText(playerRole),
    primaryGoal: cleanText(primaryGoal, BUILD_BRIEF_LIMITS.concept),
    setting: cleanText(setting, BUILD_BRIEF_LIMITS.concept),
    coreMechanics: mechanics.length ? mechanics : ["movement", "interaction", "mission objectives", "win and failure states"],
    keyCharacters,
    missionFlow: missionFlow.length ? missionFlow : ["Enter the mission area", "Complete the central objective", "Reach the victory or extraction point"],
    artDirection: cleanText(`${LOCKED_ART_DIRECTION}; ${findFirstByKeys(gdd, ["artDirection", "visualStyle", "artStyle"])}`),
    tone: cleanText(findFirstByKeys(story, ["tone", "mood", "theme"]) || findFirstByKeys(gdd, ["tone", "mood"]) || "cinematic and gameplay-focused"),
    sourceSections,
  };
}

function findFirstObjectByKeys(value: unknown, keys: string[], depth = 0): unknown {
  if (depth > 4 || !value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const [candidate, child] of Object.entries(record)) {
    if (keys.some((key) => candidate.toLowerCase() === key.toLowerCase())) return child;
  }
  for (const child of Object.values(record)) {
    if (child && typeof child === "object") {
      const found = findFirstObjectByKeys(child, keys, depth + 1);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

export function buildBriefToPrompt(brief: GameBuildBrief): string {
  const lines = [
    `${brief.title} is a ${brief.highConcept}`,
    `Player role: ${brief.playerRole}.`,
    `Primary goal: ${brief.primaryGoal}.`,
    `Setting: ${brief.setting}.`,
    `Core mechanics: ${brief.coreMechanics.join(", ")}.`,
    brief.keyCharacters.length ? `Key characters: ${brief.keyCharacters.join("; ")}.` : "",
    `Mission flow: ${brief.missionFlow.join(" → ")}.`,
    `Art direction: ${brief.artDirection}. Tone: ${brief.tone}.`,
  ].filter(Boolean);
  return lines.join("\n\n").slice(0, 2800);
}

export function projectToPlannerContext(project: GameProject): string {
  const brief = projectToBuildBrief(project);
  const sectionSnippets: string[] = [];
  const add = (label: string, value: unknown) => {
    const items = flattenMeaningfulStrings(value).slice(0, 8);
    if (items.length) sectionSnippets.push(`${label}: ${items.join(" | ")}`);
  };
  add("Story", project.designStudio.story?.result);
  add("Characters", project.designStudio.characters.map((item) => item.result));
  add("World", project.designStudio.world?.result);
  add("Quests", project.designStudio.quests.map((item) => item.result));
  add("Dialogue", project.designStudio.dialogue.map((item) => item.result));
  add("GDD", project.designStudio.gdd?.result);
  return JSON.stringify({ buildBrief: brief, sourceHighlights: sectionSnippets }, null, 0).slice(0, BUILD_BRIEF_LIMITS.context);
}

export function projectToPrompt(project: GameProject): string {
  const pieces: string[] = [];
  const push = (title: string, value: unknown) => {
    if (value === null || value === undefined) return;
    pieces.push(`${title}\n${compactJson(value)}`);
  };

  if (project.summary) pieces.push(`PROJECT SUMMARY\n${project.summary}`);
  push("STORY", project.designStudio.story?.result);
  push("CHARACTERS", project.designStudio.characters.map((item) => item.result));
  push("WORLD", project.designStudio.world?.result);
  push("QUESTS", project.designStudio.quests.map((item) => item.result));
  push("DIALOGUE", project.designStudio.dialogue.map((item) => item.result));
  push("GDD", project.designStudio.gdd?.result);
  push("BLUEPRINT", project.designStudio.blueprint);

  return pieces.join("\n\n").slice(0, 22000);
}

function compactJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function inferProjectTitle<T>(
  project: GameProject,
  section: DesignStudioSectionName,
  result: T,
) {
  if (project.title !== "Untitled Game Project") return project.title;
  if (!result || typeof result !== "object") return project.title;
  const record = result as Record<string, unknown>;
  const candidates = [
    record.characterName,
    record.worldName,
    record.questTitle,
    record.dialogueTitle,
    record.reviewTitle,
    (record.document as Record<string, unknown> | undefined)?.title,
  ];
  const title = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  return typeof title === "string" ? `${title} Project` : section === "story" ? "Story Game Project" : project.title;
}

function inferProjectSummary<T>(
  project: GameProject,
  section: DesignStudioSectionName,
  input: Record<string, unknown>,
  result: T,
) {
  if (project.summary) return project.summary;
  const inputCandidates = [input.premise, input.concept, input.prompt, input.challenge, input.gameContext];
  const fromInput = inputCandidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  if (typeof fromInput === "string") return fromInput.trim();
  if (result && typeof result === "object") {
    const record = result as Record<string, unknown>;
    const fromResult = [record.summary, record.oneLineVerdict].find(
      (candidate) => typeof candidate === "string" && candidate.trim(),
    );
    if (typeof fromResult === "string") return fromResult.trim();
  }
  return `${SECTION_LABELS[section]} saved from Design Studio.`;
}


function latestResult(project: GameProject, section: "quests" | "dialogue") {
  const entries = project.designStudio[section];
  return entries.length ? entries[entries.length - 1]?.result : undefined;
}

function sectionText(value: unknown, matcher: RegExp): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  const sections = Array.isArray(record.sections) ? record.sections : [];
  for (const item of sections) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const title = cleanText(row.title ?? row.heading ?? row.name, 120);
    if (!matcher.test(title)) continue;
    return cleanText(row.content ?? row.text ?? row.description ?? row.body, 1400);
  }
  return "";
}

function splitActionLines(value: unknown, limit = 8): string[] {
  if (Array.isArray(value)) {
    return unique(value.flatMap((item) => {
      if (typeof item === "string") return [item];
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return [cleanText(record.objective ?? record.instruction ?? record.description ?? record.title, 220)];
      }
      return [];
    }), limit);
  }
  const text = cleanText(value, 2200);
  if (!text) return [];
  return unique(text
    .split(/\n+|(?:^|\s)(?:\d+[.)]|[-•])\s+/g)
    .map((line) => line.replace(/^\s*(?:\d+[.)]|[-•])\s*/, "").trim())
    .filter((line) => line.length > 5), limit);
}

function dialogueLines(value: unknown): Array<{ speaker: string; line: string }> {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const raw = Array.isArray(record.dialogueLines)
    ? record.dialogueLines
    : Array.isArray(record.lines)
      ? record.lines
      : [];
  return raw.flatMap((item) => {
    if (typeof item === "string") {
      const match = item.match(/^([^:]{1,42}):\s*(.+)$/);
      return [{ speaker: match?.[1]?.trim() || "Mission Control", line: (match?.[2] || item).trim() }];
    }
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const line = cleanText(row.line ?? row.text ?? row.dialogue, 320);
    if (!line) return [];
    return [{ speaker: cleanText(row.speaker ?? row.character ?? row.name, 60) || "Mission Control", line }];
  }).slice(0, 16);
}

export function projectToRuntimeContent(project: GameProject): GameRuntimeContent {
  const story = project.designStudio.story?.result;
  const quest = latestResult(project, "quests");
  const dialogue = latestResult(project, "dialogue");

  const opening = sectionText(story, /opening|prologue|setup/i)
    || findFirstByKeys(story, ["opening", "premise", "summary", "logline"])
    || project.summary
    || `Begin the operation in ${project.title}.`;

  const storyBeats = unique([
    sectionText(story, /act\s*i\b|beginning|inciting/i),
    sectionText(story, /act\s*ii\b|middle|escalation/i),
    sectionText(story, /act\s*iii\b|ending|climax/i),
    sectionText(story, /twist|reveal/i),
  ].filter(Boolean), 5);

  const rawObjectives = splitActionLines(
    findFirstObjectByKeys(quest, ["objectives", "objectiveChain", "steps", "missionFlow"])
      || sectionText(quest, /objective|mission|step/i),
    6,
  );
  const fallbackObjectives = [
    "Reach the first mission marker.",
    "Interact with the critical objective.",
    "Secure the mission target.",
    "Reach the extraction point.",
  ];
  const objectiveLines = rawObjectives.length ? rawObjectives : fallbackObjectives;
  const quests: GameRuntimeContent["quests"] = objectiveLines.map((instruction, index) => ({
    id: `quest-${index + 1}`,
    title: index === objectiveLines.length - 1 ? "Extraction" : `Objective ${index + 1}`,
    instruction,
    interaction: index === objectiveLines.length - 1
      ? "extract"
      : /hack|disable|unlock|open|interact|terminal|switch|talk/i.test(instruction)
        ? "interact"
        : /collect|secure|steal|take|retrieve|obtain/i.test(instruction)
          ? "collect"
          : "reach",
  }));

  const lines = dialogueLines(dialogue);
  const runtimeDialogue: GameRuntimeContent["dialogue"] = lines.map((entry, index) => ({
    id: `dialogue-${index + 1}`,
    speaker: entry.speaker,
    line: entry.line,
    trigger: index === 0 ? "opening" : "quest",
    questIndex: index === 0 ? undefined : Math.min(quests.length - 1, index - 1),
  }));

  const victory = findFirstByKeys(story, ["ending", "resolution", "victory"])
    || "The operation is complete. The team reaches safety with the objective secured.";
  const defeat = findFirstByKeys(quest, ["failure", "failureState", "consequence"])
    || "The mission has failed. Regroup and try the operation again.";

  return {
    opening: cleanText(opening, 520),
    storyBeats: storyBeats.length ? storyBeats : [cleanText(project.summary || opening, 360)],
    quests,
    dialogue: runtimeDialogue,
    victory: cleanText(victory, 420),
    defeat: cleanText(defeat, 420),
  };
}

export function projectWorldLayout(project: GameProject): WorldLayout | undefined {
  const world = project.designStudio.world?.result as Record<string, unknown> | undefined;
  const layout = world?.layout;
  if (!layout || typeof layout !== "object" || Array.isArray(layout)) return undefined;
  const record = layout as Record<string, unknown>;
  if (!Array.isArray(record.regions)) return undefined;
  return layout as WorldLayout;
}

export function projectPlayerModelUrl(project: GameProject): string | undefined {
  const result = project.designStudio.characters[0]?.result as Record<string, unknown> | undefined;
  const value = cleanText(result?.modelUrl, 2000);
  return value || undefined;
}

export function projectEnvironmentModelUrl(project: GameProject): string | undefined {
  const result = project.designStudio.world?.result as Record<string, unknown> | undefined;
  const value = cleanText(result?.worldModelUrl ?? result?.modelUrl, 2000);
  return value || undefined;
}
