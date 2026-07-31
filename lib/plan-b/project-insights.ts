import type { DesignStudioSectionName, GameProject, StoredDesignResult } from "@/app/types/game-project";

export type ImpactItem = {
  area: DesignStudioSectionName | "production";
  label: string;
  severity: "High" | "Medium" | "Low";
  reason: string;
  actions: string[];
};

export type ScenarioAnalysis = {
  title: string;
  summary: string;
  affectedCount: number;
  impactItems: ImpactItem[];
  conflicts: string[];
  opportunities: string[];
  productionImpact: string;
  recommendation: string;
};

export function resultText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(resultText).filter(Boolean).join("\n");
  if (!value || typeof value !== "object") return "";
  return Object.values(value as Record<string, unknown>).map(resultText).filter(Boolean).join("\n");
}

export function latestSectionText(project: GameProject, section: DesignStudioSectionName): string {
  const data = project.designStudio;
  if (section === "characters" || section === "quests" || section === "dialogue") {
    const collection = data[section] as StoredDesignResult[];
    return collection.length ? resultText(collection[collection.length - 1].result) : "";
  }
  const entry = data[section] as StoredDesignResult | null;
  return entry ? resultText(entry.result) : "";
}

export function sectionReady(project: GameProject, section: DesignStudioSectionName): boolean {
  if (section === "characters" || section === "quests" || section === "dialogue") {
    return project.designStudio[section].length > 0;
  }
  return Boolean(project.designStudio[section]);
}

export function compactText(text: string, fallback: string, max = 150): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  return clean.length > max ? `${clean.slice(0, max - 1).trim()}…` : clean;
}

export function countProjectElements(project: GameProject) {
  const story = latestSectionText(project, "story");
  const characters = latestSectionText(project, "characters");
  const world = latestSectionText(project, "world");
  const quests = latestSectionText(project, "quests");
  const dialogue = latestSectionText(project, "dialogue");
  const words = `${story} ${characters} ${world} ${quests} ${dialogue}`.trim().split(/\s+/).filter(Boolean).length;
  const contentSections = ["story", "characters", "world", "quests", "dialogue"] as const;
  const contentCompleted = contentSections.filter((section) => sectionReady(project, section)).length;
  const completed = contentCompleted + (sectionReady(project, "mentor") ? 1 : 0);

  return {
    completed,
    total: 6,
    contentCompleted,
    contentTotal: contentSections.length,
    words,
    characters: project.designStudio.characters.length,
    quests: project.designStudio.quests.length,
    dialogueScenes: project.designStudio.dialogue.length,
    hasStory: Boolean(story),
    hasWorld: Boolean(world),
    hasMentorReview: sectionReady(project, "mentor"),
  };
}

export function hasGeneratedGameContent(project: GameProject): boolean {
  return countProjectElements(project).contentCompleted > 0;
}

export function auditProject(project: GameProject) {
  const metrics = countProjectElements(project);
  const completeness = Math.round((metrics.completed / metrics.total) * 100);
  const connectionBonus = ["story", "characters", "world", "quests", "dialogue"].every((section) =>
    sectionReady(project, section as DesignStudioSectionName),
  )
    ? 12
    : 0;
  const consistency = Math.min(98, Math.max(54, completeness + connectionBonus));
  const feasibility = Math.min(94, Math.max(58, 96 - metrics.quests * 2 - Math.max(0, metrics.characters - 6) * 3));
  const readiness = Math.round(completeness * 0.55 + consistency * 0.25 + feasibility * 0.2);

  const issues: string[] = [];
  if (!sectionReady(project, "story")) issues.push("The project needs a story anchor before downstream systems can be audited.");
  if (!sectionReady(project, "characters")) issues.push("No character bible is connected to the story or dialogue.");
  if (!sectionReady(project, "world")) issues.push("Locations and world rules are not yet defined.");
  if (!sectionReady(project, "quests")) issues.push("The story has no playable quest structure.");
  if (!sectionReady(project, "dialogue")) issues.push("Character intention has not been tested through dialogue.");
  if (!sectionReady(project, "mentor")) issues.push("The AI Producer review has not checked scope, risks, and priorities.");
  if (!issues.length) issues.push("No blocking consistency gaps detected in the connected design data.");

  return { completeness, consistency, feasibility, readiness, issues };
}

const AREA_META: Record<ImpactItem["area"], { label: string; baseReason: string }> = {
  story: { label: "Story Architecture", baseReason: "The central premise, conflict, turning points, and endings must remain causally aligned." },
  characters: { label: "Character System", baseReason: "Motivations, secrets, relationships, and player expectations may need revision." },
  world: { label: "World Logic", baseReason: "Locations, factions, access rules, and environmental storytelling may be affected." },
  quests: { label: "Quest Flow", baseReason: "Objectives, prerequisites, rewards, and consequences must reflect the new direction." },
  dialogue: { label: "Dialogue Network", baseReason: "Lines, subtext, branching choices, and emotional continuity need synchronized updates." },
  mentor: { label: "Design Guidance", baseReason: "The mentor must re-evaluate scope, risks, and prototype priorities." },
  gdd: { label: "Production GDD", baseReason: "The source-of-truth document must be regenerated after connected changes." },
  production: { label: "Production Scope", baseReason: "The change can alter schedule, staffing, asset count, and technical risk." },
};

function item(area: ImpactItem["area"], severity: ImpactItem["severity"], reason: string, actions: string[]): ImpactItem {
  return { area, label: AREA_META[area].label, severity, reason: `${AREA_META[area].baseReason} ${reason}`, actions };
}

export function analyzeScenario(project: GameProject, change: string): ScenarioAnalysis {
  const prompt = change.trim();
  const lower = prompt.toLowerCase();
  const items: ImpactItem[] = [];

  const identityChange = /undercover|traitor|villain|secret|betray|identity|leader/.test(lower);
  const genreChange = /sci[- ]?fi|fantasy|horror|comedy|genre|setting|cyberpunk/.test(lower);
  const mechanicChange = /stealth|combat|co-op|multiplayer|mobile|choice|remove combat|gameplay/.test(lower);
  const scopeChange = /budget|hours|scope|shorter|reduce|team|deadline|mvp/.test(lower);
  const removal = /remove|delete|without|cut/.test(lower);

  items.push(
    item("story", identityChange || genreChange ? "High" : "Medium", "Re-check the opening promise, midpoint reveal, climax, and ending consequences.", ["Rewrite affected beats", "Preserve foreshadowing", "Update ending logic"]),
    item("characters", identityChange || removal ? "High" : "Medium", "Recalculate relationship pressure, personal goals, secrets, and trust arcs.", ["Update character bible", "Re-map relationships", "Check player empathy"]),
    item("quests", mechanicChange || scopeChange ? "High" : "Medium", "Objectives and mission dependencies must express the change through play, not only exposition.", ["Revise quest prerequisites", "Update objectives", "Rebalance consequences"]),
    item("dialogue", identityChange ? "High" : "Medium", "Existing conversations may contradict the new truth or reveal it too early.", ["Add foreshadowing", "Revise choice branches", "Check voice consistency"]),
  );

  if (genreChange || mechanicChange) {
    items.push(item("world", "High", "The environment must communicate the new genre or mechanic through routes, rules, and interactable spaces.", ["Update world rules", "Revise key locations", "Check art-direction language"]));
  } else {
    items.push(item("world", "Low", "Only locations directly involved in the revised conflict need updates.", ["Mark affected locations", "Preserve stable world rules"]));
  }

  items.push(
    item("production", scopeChange || mechanicChange ? "High" : "Medium", "Re-estimate content volume, implementation effort, and test coverage before approval.", ["Recalculate scope", "Update milestone risk", "Define a validation prototype"]),
    item("gdd", "Medium", "The final document must record the approved change and every downstream revision.", ["Regenerate impacted sections", "Create a change note", "Update project readiness"]),
  );

  const affectedCount = items.reduce((sum, current) => sum + (current.severity === "High" ? 3 : current.severity === "Medium" ? 2 : 1), 0);
  const conflicts = [
    identityChange ? "Existing dialogue may reveal or contradict the new hidden identity too early." : "The requested change may create continuity gaps between story and dialogue.",
    scopeChange ? "The current content volume may exceed the revised production target." : "Quest rewards and endings must still match the revised player motivation.",
    mechanicChange ? "World layouts created for the previous mechanic may not support the new play style." : "Character motivations should remain readable after the revision.",
  ];

  const opportunities = [
    "Turn the change into a visible player choice rather than background lore.",
    "Use the revision to create stronger foreshadowing and replay value.",
    "Demonstrate GameForge's connected-update system during the judge presentation.",
  ];

  return {
    title: "Connected Change Impact",
    summary: `GameForge found ${affectedCount} connected design elements that should be reviewed before applying “${prompt}”.`,
    affectedCount,
    impactItems: items,
    conflicts,
    opportunities,
    productionImpact: scopeChange || mechanicChange ? "Significant — prototype and production estimates must be recalculated." : "Controlled — the change is achievable if all connected narrative systems are updated together.",
    recommendation: identityChange
      ? "Approve the change as a controlled narrative revision. Update foreshadowing first, then quests, dialogue, endings, and the GDD."
      : "Approve only after the highest-severity systems have a clear revision plan and success test.",
  };
}

export function appendScenarioRevision(result: unknown, change: string, analysis: ScenarioAnalysis): unknown {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return {
      original: result,
      scenarioRevisions: [{ change, summary: analysis.summary, appliedAt: new Date().toISOString() }],
    };
  }
  const record = result as Record<string, unknown>;
  const revisions = Array.isArray(record.scenarioRevisions) ? record.scenarioRevisions : [];
  return {
    ...record,
    scenarioRevisions: [
      ...revisions,
      {
        change,
        summary: analysis.summary,
        recommendation: analysis.recommendation,
        appliedAt: new Date().toISOString(),
      },
    ],
  };
}

export type ProjectRevision = {
  change: string;
  summary: string;
  recommendation?: string;
  appliedAt: string;
  source: string;
};

export function collectScenarioRevisions(project: GameProject): ProjectRevision[] {
  const revisions: ProjectRevision[] = [];
  const sources: Array<[string, unknown]> = [
    ["Story", project.designStudio.story?.result],
    ["Characters", project.designStudio.characters.at(-1)?.result],
    ["World", project.designStudio.world?.result],
    ["Quests", project.designStudio.quests.at(-1)?.result],
    ["Dialogue", project.designStudio.dialogue.at(-1)?.result],
    ["Producer", project.designStudio.mentor?.result],
    ["GDD", project.designStudio.gdd?.result],
  ];

  for (const [source, value] of sources) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const record = value as Record<string, unknown>;
    const entries = Array.isArray(record.scenarioRevisions) ? record.scenarioRevisions : [];
    for (const entry of entries) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const revision = entry as Record<string, unknown>;
      const change = typeof revision.change === "string" ? revision.change.trim() : "";
      const appliedAt = typeof revision.appliedAt === "string" ? revision.appliedAt : "";
      if (!change || !appliedAt) continue;
      revisions.push({
        change,
        summary: typeof revision.summary === "string" ? revision.summary : "Connected project revision approved.",
        recommendation: typeof revision.recommendation === "string" ? revision.recommendation : undefined,
        appliedAt,
        source,
      });
    }
  }

  const deduplicated = new Map<string, ProjectRevision>();
  for (const revision of revisions) {
    const key = `${revision.change}|${revision.appliedAt}`;
    if (!deduplicated.has(key)) deduplicated.set(key, revision);
  }
  return [...deduplicated.values()].sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
}
