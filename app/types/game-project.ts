import type { GameBlueprint } from "./blueprint";
import type { GameBuildSpec, GameTemplateFamily } from "./game";

export const DESIGN_STUDIO_SECTIONS = [
  "story",
  "characters",
  "world",
  "quests",
  "dialogue",
  "mentor",
  "gdd",
] as const;

export type DesignStudioSectionName = (typeof DESIGN_STUDIO_SECTIONS)[number];

export type StoredDesignResult<T = unknown> = {
  id: string;
  input: Record<string, unknown>;
  result: T;
  createdAt: string;
  updatedAt: string;
};

export type DesignStudioProjectData = {
  story: StoredDesignResult | null;
  characters: StoredDesignResult[];
  world: StoredDesignResult | null;
  quests: StoredDesignResult[];
  dialogue: StoredDesignResult[];
  mentor: StoredDesignResult | null;
  gdd: StoredDesignResult | null;
  blueprint: GameBlueprint | null;
};

export type GameProjectBuildState = {
  status:
    | "designing"
    | "planning"
    | "building"
    | "testing"
    | "ready"
    | "failed";
  selectedTemplate: GameTemplateFamily | null;
  lastBuild: GameBuildSpec | null;
  warning: string;
  provider: string;
  updatedAt: string | null;
};

export type GameProject = {
  schemaVersion: 1;
  id: string;
  title: string;
  summary: string;
  genre: string;
  platform: string;
  artStyle: string;
  audience: string;
  mode: string;
  createdAt: string;
  updatedAt: string;
  designStudio: DesignStudioProjectData;
  build: GameProjectBuildState;
};

export type ProjectReadiness = {
  completed: number;
  total: number;
  percent: number;
  sections: Array<{
    name: DesignStudioSectionName;
    label: string;
    count: number;
    ready: boolean;
  }>;
};
