"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { GameProject } from "@/app/types/game-project";
import {
  getOrCreateActiveGameProject,
  projectReadiness,
  saveDesignStudioSection,
} from "@/lib/game-project/client";

export type GddDocument = {
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

type ResultSection = { title: string; content: string };
type GddResult = { document: GddDocument; sections: ResultSection[]; pageCount: number; coverImageDataUrl: string | null; coverImageError: string | null };

const SECTION_LINKS: Record<string, string> = {
  story: "/story",
  characters: "/characters",
  world: "/world",
  quests: "/quests",
  dialogue: "/dialogue",
  mentor: "/mentor",
};

function clean(value: unknown, max = 2200): string {
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim().slice(0, max);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function flatten(value: unknown, depth = 0): string[] {
  if (depth > 4 || value === null || value === undefined) return [];
  if (typeof value === "string") return clean(value).length > 2 ? [clean(value)] : [];
  if (Array.isArray(value)) return value.flatMap((item) => flatten(item, depth + 1)).slice(0, 30);
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !/image|url|data|prompt|created|updated|id/i.test(key))
      .flatMap(([, child]) => flatten(child, depth + 1))
      .slice(0, 40);
  }
  return [];
}

function unique(items: string[], fallback: string[], limit = 6) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of items) {
    const value = clean(item, 260);
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    output.push(value);
    if (output.length >= limit) break;
  }
  return output.length ? output : fallback;
}

function first(value: unknown, fallback: string) {
  return flatten(value)[0] || fallback;
}

function projectSection(project: GameProject, key: "story" | "world" | "mentor") {
  return project.designStudio[key]?.result;
}

function buildAutomaticGdd(project: GameProject): GddResult {
  const story = projectSection(project, "story");
  const world = projectSection(project, "world");
  const mentor = projectSection(project, "mentor");
  const characters = project.designStudio.characters.map((item) => item.result);
  const quests = project.designStudio.quests.map((item) => item.result);
  const dialogue = project.designStudio.dialogue.map((item) => item.result);

  const storyText = flatten(story);
  const worldText = flatten(world);
  const characterText = flatten(characters);
  const questText = flatten(quests);
  const dialogueText = flatten(dialogue);
  const mentorText = flatten(mentor);
  const concept = project.summary || storyText[0] || "A connected game concept prepared in GameForge AI.";

  const document: GddDocument = {
    title: project.title,
    subtitle: "Connected Game Design Document",
    oneLinePitch: clean(concept, 320),
    executiveSummary: clean([concept, storyText[1], worldText[0]].filter(Boolean).join(" "), 1800),
    genreAndFormat: `${project.genre || "Game"} • ${project.mode || "Single Player"}`,
    targetAudience: project.audience || "Defined by the production team",
    platformsAndSession: `${project.platform || "Web / PC"}. Session length and release targets are validated during production planning.`,
    playerFantasy: storyText.find((item) => /player|role|fantasy|become|experience/i.test(item)) || concept,
    designPillars: unique([...storyText, ...worldText, ...mentorText], ["Clear player fantasy", "Connected systems", "Production-aware scope"]),
    uniqueSellingPoints: unique([...worldText, ...storyText.slice(1), ...characterText], ["A connected narrative and gameplay foundation", "Distinct characters and world identity", "Branching consequences reflected across the project"]),
    coreLoop: unique(questText, ["Explore the world", "Accept an objective", "Act and make choices", "Receive consequences and progression"], 7),
    momentToMomentGameplay: clean(questText.slice(0, 4).join(" ") || "The player navigates the world, reads the situation, performs the core action, reacts to feedback, and makes choices that update the next objective.", 1800),
    coreMechanics: unique([...questText, ...worldText], ["Exploration", "Interaction", "Objective progression", "Choice and consequence"], 8),
    controlsAndFeedback: "Controls should remain responsive, readable, and consistent with the selected runtime template. Every player action needs immediate visual, audio, and state feedback.",
    progressionAndRewards: clean(questText.slice(4, 10).join(" ") || "Progression is earned through completed objectives, discoveries, relationship changes, unlocked routes, and meaningful rewards tied to the player fantasy.", 1600),
    narrativeAndWorld: clean([...storyText.slice(0, 8), ...worldText.slice(0, 8)].join(" "), 2600),
    charactersAndFactions: clean(characterText.join(" ") || "Character concepts are connected from the Character Studio and should be reviewed for role clarity, motivation, relationships, and gameplay purpose.", 2600),
    levelsAndContent: clean([...worldText.slice(0, 10), ...questText.slice(0, 8)].join(" "), 2400),
    visualDirection: project.artStyle || "Stylized 3D game-ready presentation",
    audioDirection: clean(dialogueText.find((item) => /voice|audio|sound|music|tone/i.test(item)) || "Use clear voice direction, readable sound cues, adaptive ambience, and music that supports the emotional and gameplay states.", 1200),
    uiUxAndAccessibility: "Use a minimal interface with clear objectives, readable dialogue choices, visible relationship and consequence feedback, scalable text, keyboard support, and contrast-safe states.",
    technicalPlan: `Target platform: ${project.platform || "Web"}. Mode: ${project.mode || "Single Player"}. The project should be built through the selected runtime template with modular content data and independently testable systems.`,
    mvpScope: unique([...mentorText, ...questText], ["One polished playable loop", "One complete environment", "Core player character", "A representative quest chain", "Dialogue and consequence demonstration"], 7),
    productionMilestones: ["Design approval and content lock", "Playable greybox and control validation", "Core art and asset integration", "Narrative and dialogue implementation", "Quality assurance and final presentation build"],
    risksAndMitigations: unique(mentorText.filter((item) => /risk|scope|issue|limit|avoid|mitig/i.test(item)), ["Scope growth — protect the MVP and defer optional systems", "Content inconsistency — review every change against the connected project", "Runtime quality — test controls and performance before adding more content"], 6),
    successMetrics: ["The core player fantasy is understood within the opening minutes", "The main gameplay loop is complete and repeatable", "Dialogue choices produce visible consequences", "The build remains stable on the target platform", "The team can implement from the handoff without missing dependencies"],
    openQuestions: unique(mentorText.filter((item) => /question|decide|confirm|unknown|open/i.test(item)), ["Which features are mandatory for the exhibition build?", "Which target device defines the performance budget?", "Which content requires final stakeholder approval?"], 6),
    coverImagePrompt: `${project.title}, ${project.artStyle}, cinematic game key art representing ${clean(concept, 500)}`,
  };

  const sections: ResultSection[] = [
    ["Executive Summary", document.executiveSummary],
    ["Player Fantasy", document.playerFantasy],
    ["Design Pillars", document.designPillars.map((item) => `• ${item}`).join("\n")],
    ["Core Gameplay Loop", document.coreLoop.map((item, index) => `${index + 1}. ${item}`).join("\n")],
    ["Narrative and World", document.narrativeAndWorld],
    ["Characters and Factions", document.charactersAndFactions],
    ["Quests and Content", document.levelsAndContent],
    ["Dialogue and Audio", `${document.audioDirection}\n\n${clean(dialogueText.slice(0, 8).join(" "), 1600)}`],
    ["Production and MVP", document.mvpScope.map((item) => `• ${item}`).join("\n")],
    ["Risks and Mitigations", document.risksAndMitigations.map((item) => `• ${item}`).join("\n")],
  ].map(([title, content]) => ({ title, content }));

  return { document, sections, pageCount: 16, coverImageDataUrl: null, coverImageError: null };
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

export default function FinalGddPage() {
  const [project, setProject] = useState<GameProject | null>(null);
  const [result, setResult] = useState<GddResult | null>(null);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const current = getOrCreateActiveGameProject();
    const generated = buildAutomaticGdd(current);
    const readiness = projectReadiness(current);
    setProject(current);
    setResult(generated);
    if (readiness.percent === 100) {
      saveDesignStudioSection("gdd", { source: "automatic-final-build", projectId: current.id, completedSections: readiness.total }, generated);
    }
  }, []);

  const readiness = useMemo(() => projectReadiness(project), [project]);
  const missing = readiness.sections.filter((section) => !section.ready);
  const outlineText = useMemo(() => result ? [`${result.document.title} — ${result.document.subtitle}`, result.document.oneLinePitch, ...result.sections.map((section) => `${section.title}\n${section.content}`)].join("\n\n") : "", [result]);
  const slug = result?.document.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "game-project";

  async function copyOutline() {
    if (!outlineText) return;
    await navigator.clipboard.writeText(outlineText);
    setMessage("GDD copied");
    window.setTimeout(() => setMessage(""), 1400);
  }

  function downloadMarkdown() {
    if (!result) return;
    const text = [`# ${result.document.title}`, `## ${result.document.subtitle}`, `> ${result.document.oneLinePitch}`, ...result.sections.flatMap((section) => [`## ${section.title}`, section.content])].join("\n\n");
    saveBlob(new Blob([text], { type: "text/markdown;charset=utf-8" }), `${slug}-gdd.md`);
  }

  function downloadJson() {
    if (!result) return;
    saveBlob(new Blob([JSON.stringify(result.document, null, 2)], { type: "application/json" }), `${slug}-gdd.json`);
  }

  function downloadWord() {
    if (!result) return;
    const body = result.sections.map((section) => `<h2>${section.title}</h2><p>${section.content.replace(/\n/g, "<br>")}</p>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${result.document.title}</title><style>body{font-family:Arial,sans-serif;max-width:900px;margin:48px auto;color:#171717;line-height:1.65}h1{font-size:38px}h2{margin-top:32px;color:#5b21b6}blockquote{font-size:20px;color:#334155}</style></head><body><h1>${result.document.title}</h1><h3>${result.document.subtitle}</h3><blockquote>${result.document.oneLinePitch}</blockquote>${body}</body></html>`;
    saveBlob(new Blob([html], { type: "application/msword;charset=utf-8" }), `${slug}-gdd.doc`);
  }

  async function downloadPdf() {
    if (!result) return;
    setExporting(true);
    setMessage("");
    try {
      const response = await fetch("/api/gdd/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ document: result.document, metadata: { documentStyle: "Automatic connected GDD", platform: project?.platform, projectStage: "Production review", teamSize: "Defined in production" } }) });
      if (!response.ok) throw new Error("The PDF could not be created.");
      saveBlob(await response.blob(), `${slug}-gdd.pdf`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The PDF could not be created.");
    } finally {
      setExporting(false);
    }
  }

  if (!project || !result) return <main className="grid min-h-screen place-items-center bg-[#05040a] text-white"><p className="text-zinc-400">Assembling the final GDD…</p></main>;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05040a] pb-24 pt-28 text-white sm:pt-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(16,185,129,.14),transparent_30%),radial-gradient(circle_at_84%_18%,rgba(34,211,238,.12),transparent_30%),radial-gradient(circle_at_55%_84%,rgba(124,58,237,.12),transparent_34%)]" />
      <div className="relative mx-auto w-full max-w-[1450px] px-5 sm:px-8">
        <section className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-300">Final production document</p>
            <h1 className="mt-4 text-5xl font-black tracking-[-.045em] sm:text-6xl">Your GDD builds itself from the finished project.</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-400">No repeated form. No separate seventh Design Studio task. Story, characters, world, quests, dialogue, and the AI Producer review are automatically assembled here.</p>
          </div>
          <div className={`rounded-2xl border px-5 py-4 ${readiness.percent === 100 ? "border-emerald-300/25 bg-emerald-300/[0.08]" : "border-amber-300/25 bg-amber-300/[0.08]"}`}><p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Source completion</p><p className="mt-1 text-2xl font-black">{readiness.completed}/{readiness.total}</p></div>
        </section>

        {missing.length ? (
          <section className="mt-8 rounded-[26px] border border-amber-300/20 bg-amber-300/[0.06] p-6">
            <p className="font-black text-amber-100">This is an automatic draft. Complete the missing sections to lock the final document.</p>
            <div className="mt-4 flex flex-wrap gap-3">{missing.map((section) => <Link key={section.name} href={SECTION_LINKS[section.name] || "/design-studio"} className="rounded-full border border-amber-200/20 bg-black/20 px-4 py-2 text-sm font-bold text-amber-50">Complete {section.label}</Link>)}</div>
          </section>
        ) : (
          <section className="mt-8 flex flex-col gap-4 rounded-[26px] border border-emerald-300/20 bg-emerald-300/[0.06] p-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-emerald-100">Final GDD synchronized</p><p className="mt-1 text-sm text-emerald-50/65">Every core Design Studio section is complete and connected.</p></div><Link href="/team-workspace" className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-5 py-3 text-center font-black text-emerald-100">Continue to team handoff</Link></section>
        )}

        <section className="mt-8 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-[30px] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Document controls</p>
            <h2 className="mt-3 text-2xl font-black">{project.title}</h2>
            <p className="mt-3 leading-7 text-zinc-400">{result.document.oneLinePitch}</p>
            <div className="mt-6 space-y-3">
              <button type="button" onClick={downloadPdf} disabled={exporting} className="h-12 w-full rounded-2xl bg-gradient-to-r from-emerald-600 via-cyan-600 to-violet-600 font-black disabled:opacity-60">{exporting ? "Creating PDF…" : "Download presentation PDF"}</button>
              <button type="button" onClick={downloadWord} className="h-12 w-full rounded-2xl border border-blue-300/20 bg-blue-300/[0.07] font-black text-blue-100">Download Word document</button>
              <div className="grid grid-cols-2 gap-3"><button type="button" onClick={downloadMarkdown} className="h-11 rounded-xl border border-white/10 bg-white/[0.04] font-bold">Markdown</button><button type="button" onClick={downloadJson} className="h-11 rounded-xl border border-white/10 bg-white/[0.04] font-bold">JSON</button></div>
              <button type="button" onClick={copyOutline} className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] font-bold">{message === "GDD copied" ? message : "Copy complete GDD"}</button>
            </div>
            {message && message !== "GDD copied" ? <p className="mt-4 text-sm font-bold text-rose-200">{message}</p> : null}
            <Link href="/production-intelligence" className="mt-6 block text-center text-sm font-black text-cyan-200">← Back to production</Link>
          </aside>

          <article className="overflow-hidden rounded-[30px] border border-white/10 bg-[#f7f5ef] text-zinc-900 shadow-[0_32px_100px_rgba(0,0,0,.45)]">
            <header className="bg-[linear-gradient(135deg,#111827,#312e81_60%,#0e7490)] p-8 text-white sm:p-12">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Game Design Document</p><h2 className="mt-5 text-4xl font-black tracking-[-.035em] sm:text-5xl">{result.document.title}</h2><p className="mt-3 text-xl text-white/75">{result.document.subtitle}</p><p className="mt-8 max-w-3xl text-lg leading-8 text-white/85">{result.document.oneLinePitch}</p>
            </header>
            <div className="space-y-10 p-7 sm:p-12">
              {result.sections.map((section, index) => <section key={section.title} className="border-b border-zinc-200 pb-9 last:border-none"><div className="flex items-center gap-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-100 text-sm font-black text-violet-800">{String(index + 1).padStart(2, "0")}</span><h3 className="text-2xl font-black">{section.title}</h3></div><div className="mt-5 whitespace-pre-line leading-8 text-zinc-700">{section.content}</div></section>)}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
