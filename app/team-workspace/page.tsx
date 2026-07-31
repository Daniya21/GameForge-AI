"use client";

import Link from "next/link";
import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { GameProject } from "@/app/types/game-project";
import { GAME_PROJECT_EVENT, getOrCreateActiveGameProject } from "@/lib/game-project/client";
import { countProjectElements } from "@/lib/plan-b/project-insights";
import {
  productionPlanIsCurrent,
  projectHasProductionInputs,
  readProductionPlan,
  type ProductionPlan,
  type ProductionRole,
} from "@/lib/production/plan";

type TaskStatus = "Planned" | "In review" | "Approved";

type Task = {
  id: string;
  role: string;
  title: string;
  detail: string;
  milestone: string;
  status: TaskStatus;
};

type ReviewNote = {
  id: string;
  author: string;
  message: string;
  createdAt: string;
};

const statusOrder: TaskStatus[] = ["Planned", "In review", "Approved"];

function storageKey(projectId: string) {
  return `gameforge.teamWorkspace.v2.${projectId}`;
}

function roleTask(role: ProductionRole, project: GameProject): Omit<Task, "status"> {
  const metrics = countProjectElements(project);
  const normalized = role.role.toLowerCase();

  if (normalized.includes("producer")) {
    return {
      id: "producer-scope",
      role: role.role,
      title: "Confirm scope, owners, milestones, and approval gates",
      detail: `Coordinate the ${project.title} production plan, protect the approved scope, and keep every team lane aligned with the generated project data.`,
      milestone: "Production setup",
    };
  }
  if (normalized.includes("game designer")) {
    return {
      id: "designer-systems",
      role: role.role,
      title: "Convert the generated concept into implementation rules",
      detail: `Define the playable loop, controls, progression, failure states, rewards, and acceptance criteria using ${metrics.contentCompleted} connected design sections.`,
      milestone: "Pre-production",
    };
  }
  if (normalized.includes("narrative")) {
    return {
      id: "narrative-continuity",
      role: role.role,
      title: "Prepare story, quest, and dialogue continuity handoff",
      detail: `Review ${metrics.quests} quest${metrics.quests === 1 ? "" : "s"} and ${metrics.dialogueScenes} dialogue scene${metrics.dialogueScenes === 1 ? "" : "s"} against the generated characters, world rules, and story direction.`,
      milestone: "Narrative implementation",
    };
  }
  if (normalized.includes("character")) {
    return {
      id: "character-pipeline",
      role: role.role,
      title: "Prepare generated characters for production",
      detail: `Review, optimize, name, scale, rig, and document ${metrics.characters} generated character asset${metrics.characters === 1 ? "" : "s"} for gameplay integration.`,
      milestone: "Character production",
    };
  }
  if (normalized.includes("environment") || normalized.includes("world")) {
    return {
      id: "environment-pipeline",
      role: role.role,
      title: "Translate the world blueprint into playable spaces",
      detail: "Create the blockout, routes, landmarks, prop list, lighting direction, collision requirements, and performance budget from the generated World section.",
      milestone: "World production",
    };
  }
  if (normalized.includes("engineer")) {
    return {
      id: "engineering-build",
      role: role.role,
      title: "Implement the playable systems and integration pipeline",
      detail: "Build controls, interactions, state management, quest and dialogue logic, asset loading, save behavior, and the testable game build required by the production plan.",
      milestone: "Core implementation",
    };
  }
  if (normalized.includes("audio") || normalized.includes("voice")) {
    return {
      id: "audio-dialogue",
      role: role.role,
      title: "Prepare dialogue performance and audio implementation",
      detail: `Create the voice direction, naming structure, processing rules, and runtime triggers for ${metrics.dialogueScenes} generated dialogue scene${metrics.dialogueScenes === 1 ? "" : "s"}.`,
      milestone: "Audio integration",
    };
  }
  if (normalized.includes("qa") || normalized.includes("playtest")) {
    return {
      id: "qa-acceptance",
      role: role.role,
      title: "Validate the complete playable flow",
      detail: "Test controls, quest states, dialogue branches, asset loading, performance, accessibility, failure recovery, and final acceptance criteria.",
      milestone: "QA and polish",
    };
  }

  return {
    id: `role-${role.role.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    role: role.role,
    title: `Complete the ${role.role} production lane`,
    detail: role.reason,
    milestone: "Production",
  };
}

function buildTasks(project: GameProject, plan: ProductionPlan): Task[] {
  return plan.roles.map((role) => ({
    ...roleTask(role, project),
    status: "Planned" as TaskStatus,
  }));
}

function fileSafe(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "game-project";
}

export default function TeamWorkspacePage() {
  const [project, setProject] = useState<GameProject | null>(null);
  const [plan, setPlan] = useState<ProductionPlan | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<ReviewNote[]>([]);
  const [author, setAuthor] = useState("Project Lead");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadProject = (next: GameProject) => {
      setProject(next);
      const savedPlan = readProductionPlan(next);
      const currentPlan = productionPlanIsCurrent(next, savedPlan) ? savedPlan : null;
      setPlan(currentPlan);

      if (!currentPlan) {
        setTasks([]);
        setNotes([]);
        return;
      }

      const generatedTasks = buildTasks(next, currentPlan);
      try {
        const savedWorkspace = window.localStorage.getItem(storageKey(next.id));
        if (!savedWorkspace) {
          setTasks(generatedTasks);
          setNotes([]);
          return;
        }
        const parsed = JSON.parse(savedWorkspace) as { tasks?: Task[]; notes?: ReviewNote[]; planGeneratedAt?: string };
        if (parsed.planGeneratedAt !== currentPlan.generatedAt) {
          setTasks(generatedTasks);
          setNotes([]);
          return;
        }
        const statusById = new Map((parsed.tasks || []).map((task) => [task.id, task.status]));
        setTasks(generatedTasks.map((task) => ({ ...task, status: statusById.get(task.id) || task.status })));
        setNotes(Array.isArray(parsed.notes) ? parsed.notes : []);
      } catch {
        setTasks(generatedTasks);
        setNotes([]);
      }
    };

    const frame = window.requestAnimationFrame(() => loadProject(getOrCreateActiveGameProject()));
    const onUpdate = (event: Event) => loadProject((event as CustomEvent<GameProject>).detail ?? getOrCreateActiveGameProject());
    window.addEventListener(GAME_PROJECT_EVENT, onUpdate);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(GAME_PROJECT_EVENT, onUpdate);
    };
  }, []);

  useEffect(() => {
    if (!project || !plan || !tasks.length) return;
    window.localStorage.setItem(storageKey(project.id), JSON.stringify({ tasks, notes, planGeneratedAt: plan.generatedAt }));
  }, [project, plan, tasks, notes]);

  const approved = tasks.filter((task) => task.status === "Approved").length;
  const inReview = tasks.filter((task) => task.status === "In review").length;
  const progress = tasks.length ? Math.round((approved / tasks.length) * 100) : 0;
  const roleGroups = useMemo(() => Array.from(new Set(tasks.map((task) => task.role))), [tasks]);

  function cycleTask(id: string) {
    setTasks((current) => current.map((task) => {
      if (task.id !== id) return task;
      const index = statusOrder.indexOf(task.status);
      return { ...task, status: statusOrder[(index + 1) % statusOrder.length] };
    }));
  }

  function addNote() {
    const clean = message.trim();
    if (!clean) return;
    setNotes((current) => [{ id: `note-${Date.now()}`, author: author.trim() || "Reviewer", message: clean, createdAt: new Date().toISOString() }, ...current]);
    setMessage("");
  }

  function regenerateTasks() {
    if (!project || !plan) return;
    setTasks(buildTasks(project, plan));
    setNotes([]);
  }

  function exportBrief() {
    if (!project || !plan) return;
    const lines = [
      `# ${project.title} — Team Handoff Brief`,
      "",
      `Generated from production plan: ${new Date(plan.generatedAt).toLocaleString()}`,
      `Scope: ${plan.scope}`,
      `Resource level: ${plan.budget}`,
      `Recommended team: ${plan.teamCount}`,
      `Estimated duration: ${plan.durationWeeks} weeks`,
      `Source sections: ${plan.sourceSections.join(", ")}`,
      `Task approval: ${approved}/${tasks.length}`,
      "",
      "## Team roles",
      "",
      ...plan.roles.flatMap((role) => [
        `- **${role.role}: ${role.count}**`,
        `  - ${role.reason}`,
      ]),
      "",
      "## Role-based tasks",
      "",
      ...roleGroups.flatMap((role) => [
        `### ${role}`,
        "",
        ...tasks.filter((task) => task.role === role).flatMap((task) => [
          `- [${task.status === "Approved" ? "x" : " "}] **${task.title}** — ${task.status}`,
          `  - Milestone: ${task.milestone}`,
          `  - ${task.detail}`,
        ]),
        "",
      ]),
      "## Review notes",
      "",
      ...(notes.length ? notes.map((note) => `- **${note.author}** (${new Date(note.createdAt).toLocaleString()}): ${note.message}`) : ["- No review notes recorded."]),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileSafe(project.title)}-team-handoff.md`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  if (!project) {
    return <main className="grid min-h-screen place-items-center pt-24 text-white"><p className="text-zinc-400">Preparing Team Handoff…</p></main>;
  }

  const hasInputs = projectHasProductionInputs(project);

  return (
    <main className="relative min-h-screen overflow-hidden px-5 pb-24 pt-28 text-white sm:px-8 sm:pt-32">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_12%,rgba(6,182,212,.14),transparent_32%),radial-gradient(circle_at_88%_18%,rgba(124,58,237,.15),transparent_30%)]" />
      <div className="mx-auto w-full max-w-[1480px]">
        <section className="grid gap-8 lg:grid-cols-[1fr_410px] lg:items-end">
          <div>
            <div className="inline-flex items-center rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-100">Production handoff</div>
            <h1 className="mt-6 max-w-5xl text-5xl font-black leading-[.98] tracking-tight sm:text-6xl lg:text-7xl">Assign real work from the <span className="bg-gradient-to-r from-cyan-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">generated production plan.</span></h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-400">Team roles, task lanes, approval progress, and exports remain empty until a current Production plan exists for this project.</p>
          </div>
          <aside className="rounded-[28px] border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm font-bold text-zinc-500">Active project</p>
            <h2 className="mt-3 text-2xl font-black">{project.title}</h2>
            {plan ? (
              <>
                <div className="mt-5 flex items-center justify-between text-sm"><span className="text-zinc-500">Handoff approval</span><strong>{progress}%</strong></div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-500 to-fuchsia-500" style={{ width: `${progress}%` }} /></div>
                <p className="mt-4 text-sm text-zinc-500">{approved} approved · {inReview} in review · {tasks.length - approved - inReview} planned</p>
              </>
            ) : <p className="mt-4 text-sm leading-6 text-zinc-500">No current handoff has been generated.</p>}
          </aside>
        </section>

        {!hasInputs ? (
          <section className="mt-12 rounded-[34px] border border-dashed border-white/12 bg-white/[0.025] px-6 py-20 text-center sm:px-10">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.08] text-3xl">◇</div>
            <h2 className="mt-6 text-3xl font-black">Nothing to hand off yet</h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-500">This project has no generated game content, so GameForge will not create team numbers, task lanes, or Planned items.</p>
            <Link href="/design-studio" className="mt-7 inline-flex rounded-2xl bg-gradient-to-r from-cyan-600 via-violet-600 to-fuchsia-600 px-6 py-3.5 font-black">Open Design Studio</Link>
          </section>
        ) : !plan ? (
          <section className="mt-12 rounded-[34px] border border-dashed border-white/12 bg-white/[0.025] px-6 py-20 text-center sm:px-10">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-violet-300/20 bg-violet-300/[0.08] text-3xl">→</div>
            <h2 className="mt-6 text-3xl font-black">Generate Production first</h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-500">A Team Handoff is created only from a current Production plan. Generate or regenerate the plan after completing your design work.</p>
            <Link href="/production-intelligence" className="mt-7 inline-flex rounded-2xl bg-gradient-to-r from-emerald-600 via-cyan-600 to-violet-600 px-6 py-3.5 font-black">Go to Production</Link>
          </section>
        ) : (
          <>
            <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Team members", plan.teamCount, "From the approved production plan"],
                ["Role lanes", roleGroups.length, "Only required disciplines"],
                ["Generated tasks", tasks.length, "One accountable lane per role"],
                ["Review notes", notes.length, "Recorded team decisions"],
              ].map(([label, value, detail]) => (
                <article key={String(label)} className="rounded-[24px] border border-white/9 bg-white/[0.035] p-5">
                  <p className="text-xs font-black uppercase tracking-[0.15em] text-zinc-500">{label}</p>
                  <p className="mt-5 text-3xl font-black text-white">{value}</p>
                  <p className="mt-2 text-sm text-zinc-400">{detail}</p>
                </article>
              ))}
            </section>

            <section className="mt-8 grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
              <div className="rounded-[30px] border border-white/10 bg-white/[0.025] p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Implementation task board</p>
                    <h2 className="mt-2 text-3xl font-black">Role-based handoff</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={regenerateTasks} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black text-zinc-300">Reset generated tasks</button>
                    <button type="button" onClick={exportBrief} className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2 text-xs font-black text-white">Export handoff</button>
                  </div>
                </div>
                <div className="mt-7 space-y-3">
                  {tasks.map((task) => (
                    <article key={task.id} className="grid gap-4 rounded-[22px] border border-white/8 bg-white/[0.03] p-5 md:grid-cols-[170px_minmax(0,1fr)_auto] md:items-center">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.15em] text-cyan-300">{task.role}</p>
                        <p className="mt-2 text-xs text-zinc-600">{task.milestone}</p>
                      </div>
                      <div>
                        <h3 className="font-black text-white">{task.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-zinc-400">{task.detail}</p>
                      </div>
                      <button type="button" onClick={() => cycleTask(task.id)} className={`min-w-28 rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.13em] ${task.status === "Approved" ? "bg-emerald-300/10 text-emerald-200" : task.status === "In review" ? "bg-amber-300/10 text-amber-200" : "bg-white/7 text-zinc-400"}`}>{task.status}</button>
                    </article>
                  ))}
                </div>
              </div>

              <aside className="space-y-6">
                <div className="rounded-[30px] border border-white/10 bg-white/[0.035] p-6">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">Production source</p>
                  <div className="mt-5 space-y-3">
                    {plan.roles.map((role) => (
                      <div key={role.role} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                        <div className="flex items-center justify-between gap-4"><strong className="text-sm">{role.role}</strong><span className="rounded-full bg-violet-300/10 px-3 py-1 text-xs font-black text-violet-200">{role.count}</span></div>
                        <p className="mt-2 text-xs leading-5 text-zinc-500">{role.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[30px] border border-white/10 bg-white/[0.035] p-6">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-300">Feedback record</p>
                  <h2 className="mt-2 text-2xl font-black">Add a review note</h2>
                  <div className="mt-5 space-y-4">
                    <div>
                      <label htmlFor="review-author" className="mb-2 block text-sm font-bold text-zinc-300">Reviewer</label>
                      <input id="review-author" value={author} onChange={(event: ChangeEvent<HTMLInputElement>) => setAuthor(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none focus:border-cyan-300/40" />
                    </div>
                    <div>
                      <label htmlFor="review-message" className="mb-2 block text-sm font-bold text-zinc-300">Feedback or approval condition</label>
                      <textarea id="review-message" value={message} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setMessage(event.target.value)} className="min-h-28 w-full resize-y rounded-2xl border border-white/10 bg-black/25 p-4 text-white outline-none placeholder:text-zinc-600 focus:border-cyan-300/40" placeholder="Write a real production decision or approval condition." />
                    </div>
                    <button type="button" onClick={addNote} disabled={!message.trim()} className="w-full rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-3 font-black text-white disabled:opacity-40">Record review note</button>
                  </div>
                </div>

                <div className="rounded-[30px] border border-white/10 bg-white/[0.025] p-6">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Decision history</p>
                  <div className="mt-5 space-y-3">
                    {notes.length ? notes.slice(0, 6).map((note) => (
                      <article key={note.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <div className="flex items-center justify-between gap-3"><strong className="text-sm">{note.author}</strong><span className="text-[10px] text-zinc-600">{new Date(note.createdAt).toLocaleString()}</span></div>
                        <p className="mt-2 text-sm leading-6 text-zinc-400">{note.message}</p>
                      </article>
                    )) : <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm leading-6 text-zinc-500">No review notes have been added.</p>}
                  </div>
                </div>

                <Link href="/gdd-export" className="block rounded-[28px] bg-gradient-to-br from-violet-600 via-fuchsia-600 to-cyan-500 p-6 font-black text-white shadow-[0_20px_60px_rgba(124,58,237,.25)]">Prepare final documentation <span className="float-right">→</span></Link>
              </aside>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
