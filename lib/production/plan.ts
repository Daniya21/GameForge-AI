import type { GameProject } from "@/app/types/game-project";
import { countProjectElements, sectionReady } from "@/lib/plan-b/project-insights";

export const PRODUCTION_SCOPE_OPTIONS = [
  "Exhibition Prototype",
  "Vertical Slice",
  "Small Commercial Game",
] as const;

export const PRODUCTION_BUDGET_OPTIONS = ["Lean", "Standard", "Premium"] as const;

export type ProductionScope = (typeof PRODUCTION_SCOPE_OPTIONS)[number];
export type ProductionBudget = (typeof PRODUCTION_BUDGET_OPTIONS)[number];

export type ProductionRole = {
  role: string;
  count: number;
  reason: string;
};

export type ProductionPhase = {
  label: string;
  duration: string;
  detail: string;
};

export type ProductionPlan = {
  version: 2;
  projectId: string;
  sourceFingerprint: string;
  generatedAt: string;
  scope: ProductionScope;
  budget: ProductionBudget;
  sourceSections: string[];
  sourceSummary: {
    characters: number;
    quests: number;
    dialogueScenes: number;
    generatedSections: number;
  };
  feasibility: number;
  teamCount: number;
  durationWeeks: number;
  assetCount: number;
  qaWeeks: number;
  roles: ProductionRole[];
  phases: ProductionPhase[];
  risks: string[];
  deliverables: string[];
};

export function productionPlanStorageKey(projectId: string) {
  return `gameforge.productionPlan.v2.${projectId}`;
}

export function projectHasProductionInputs(project: GameProject) {
  return countProjectElements(project).contentCompleted > 0;
}

export function productionSourceFingerprint(project: GameProject) {
  return [
    project.title,
    project.summary,
    project.genre,
    project.platform,
    project.audience,
    project.mode,
    project.designStudio.story?.updatedAt || "",
    project.designStudio.characters.map((entry) => `${entry.id}:${entry.updatedAt}`).join(","),
    project.designStudio.world?.updatedAt || "",
    project.designStudio.quests.map((entry) => `${entry.id}:${entry.updatedAt}`).join(","),
    project.designStudio.dialogue.map((entry) => `${entry.id}:${entry.updatedAt}`).join(","),
    project.designStudio.mentor?.updatedAt || "",
  ].join("|");
}

function completedSectionLabels(project: GameProject) {
  const sections: Array<["story" | "characters" | "world" | "quests" | "dialogue", string]> = [
    ["story", "Story"],
    ["characters", "Characters"],
    ["world", "World"],
    ["quests", "Quests"],
    ["dialogue", "Dialogue"],
  ];
  return sections.filter(([key]) => sectionReady(project, key)).map(([, label]) => label);
}

export function buildProductionPlan(
  project: GameProject,
  scope: ProductionScope,
  budget: ProductionBudget,
): ProductionPlan {
  const metrics = countProjectElements(project);
  const sourceSections = completedSectionLabels(project);
  const scopeScale = scope === "Exhibition Prototype" ? 0.65 : scope === "Vertical Slice" ? 1 : 1.75;
  const speedScale = budget === "Premium" ? 0.82 : budget === "Lean" ? 1.2 : 1;

  const roles: ProductionRole[] = [
    {
      role: "Producer / Project Lead",
      count: 1,
      reason: "Owns scope, milestones, approvals, and the final production handoff.",
    },
    {
      role: "Game Designer",
      count: scope === "Small Commercial Game" ? 2 : 1,
      reason: "Turns the generated concept into mechanics, progression, balancing, and testable player goals.",
    },
  ];

  if (metrics.hasStory || metrics.quests > 0 || metrics.dialogueScenes > 0) {
    roles.push({
      role: "Narrative Designer",
      count: 1,
      reason: "Maintains continuity across story, quests, character motivations, and generated dialogue.",
    });
  }
  if (metrics.characters > 0) {
    roles.push({
      role: "Character Artist / 3D Generalist",
      count: scope === "Small Commercial Game" && metrics.characters >= 4 ? 2 : 1,
      reason: `Produces and prepares ${metrics.characters} generated character${metrics.characters === 1 ? "" : "s"} for the game pipeline.`,
    });
  }
  if (metrics.hasWorld) {
    roles.push({
      role: "Environment Artist / World Builder",
      count: scope === "Small Commercial Game" ? 2 : 1,
      reason: "Converts the generated world direction into playable spaces, props, lighting, and navigation.",
    });
  }

  const engineerCount = scope === "Exhibition Prototype" ? 1 : scope === "Vertical Slice" ? 2 : 3;
  roles.push({
    role: "Gameplay Engineer",
    count: engineerCount,
    reason: "Implements controls, interactions, game state, dialogue logic, builds, and performance requirements.",
  });

  if (metrics.dialogueScenes > 0) {
    roles.push({
      role: "Audio / Voice Support",
      count: 1,
      reason: `Prepares voice direction and audio implementation for ${metrics.dialogueScenes} generated dialogue scene${metrics.dialogueScenes === 1 ? "" : "s"}.`,
    });
  }
  if (scope !== "Exhibition Prototype" || metrics.quests > 0) {
    roles.push({
      role: "QA / Playtest",
      count: 1,
      reason: "Validates controls, quest flow, dialogue states, readability, stability, and acceptance criteria.",
    });
  }

  const teamCount = roles.reduce((sum, role) => sum + role.count, 0);
  const contentWeight =
    sourceSections.length * 1.5 +
    metrics.characters * 1.2 +
    metrics.quests * 1.5 +
    metrics.dialogueScenes * 0.75;
  const baseWeeks = scope === "Exhibition Prototype" ? 4 : scope === "Vertical Slice" ? 14 : 34;
  const durationWeeks = Math.max(2, Math.round((baseWeeks + contentWeight * scopeScale) * speedScale));
  const assetCount = Math.max(
    1,
    Math.round(
      (metrics.characters * 4 +
        metrics.quests * 3 +
        metrics.dialogueScenes * 2 +
        (metrics.hasWorld ? 10 : 0) +
        (metrics.hasStory ? 2 : 0)) *
        scopeScale,
    ),
  );
  const qaWeeks = Math.max(1, Math.round(durationWeeks * (scope === "Exhibition Prototype" ? 0.2 : 0.28)));
  const completeness = Math.round((metrics.contentCompleted / metrics.contentTotal) * 100);
  const scopePenalty = scope === "Small Commercial Game" ? 12 : scope === "Vertical Slice" ? 4 : 0;
  const budgetAdjustment = budget === "Premium" ? 6 : budget === "Lean" ? -5 : 0;
  const feasibility = Math.max(35, Math.min(96, 58 + Math.round(completeness * 0.35) - scopePenalty + budgetAdjustment));

  const phases: ProductionPhase[] = [
    {
      label: "Pre-production",
      duration: `${Math.max(1, Math.round(durationWeeks * 0.2))} weeks`,
      detail: `Validate the generated ${sourceSections.join(", ").toLowerCase()} and lock the smallest playable scope.`,
    },
    {
      label: "Core implementation",
      duration: `${Math.max(1, Math.round(durationWeeks * 0.45))} weeks`,
      detail: "Build controls, gameplay systems, content pipelines, and the first complete playable path.",
    },
    {
      label: "Content integration",
      duration: `${Math.max(1, Math.round(durationWeeks * 0.22))} weeks`,
      detail: "Integrate approved characters, world assets, quests, dialogue, UI, and audio required by this project.",
    },
    {
      label: "QA and polish",
      duration: `${qaWeeks} weeks`,
      detail: "Test the complete flow, fix blockers, improve readability, optimize performance, and prepare the handoff build.",
    },
  ];

  const risks = [
    metrics.contentCompleted < 3
      ? "The estimate is early because fewer than three core design sections have been generated. Regenerate the plan as the project develops."
      : "Any major design change should trigger a fresh production plan before work is assigned.",
    !metrics.hasWorld
      ? "No world blueprint is connected yet, so environment workload is not included."
      : "World scope must be controlled so environment production does not exceed the selected target.",
    metrics.dialogueScenes === 0
      ? "Dialogue and voice workload are not included because no dialogue scene has been generated."
      : "Branching dialogue requires state tracking, continuity testing, and voice-production review.",
  ];

  const deliverables = [
    "Approved playable scope",
    ...sourceSections.map((section) => `${section} implementation brief`),
    "Role-based team handoff",
    "Milestone and QA checklist",
    "Final GDD after design completion",
  ];

  return {
    version: 2,
    projectId: project.id,
    sourceFingerprint: productionSourceFingerprint(project),
    generatedAt: new Date().toISOString(),
    scope,
    budget,
    sourceSections,
    sourceSummary: {
      characters: metrics.characters,
      quests: metrics.quests,
      dialogueScenes: metrics.dialogueScenes,
      generatedSections: metrics.contentCompleted,
    },
    feasibility,
    teamCount,
    durationWeeks,
    assetCount,
    qaWeeks,
    roles,
    phases,
    risks,
    deliverables,
  };
}

export function readProductionPlan(project: GameProject): ProductionPlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(productionPlanStorageKey(project.id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProductionPlan;
    if (parsed.version !== 2 || parsed.projectId !== project.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function productionPlanIsCurrent(project: GameProject, plan: ProductionPlan | null) {
  return Boolean(plan && plan.projectId === project.id && plan.sourceFingerprint === productionSourceFingerprint(project));
}

export function saveProductionPlan(plan: ProductionPlan) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(productionPlanStorageKey(plan.projectId), JSON.stringify(plan));
}
