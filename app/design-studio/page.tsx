"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { DesignStudioSectionName, GameProject } from "@/app/types/game-project";
import {
  GAME_PROJECT_EVENT,
  GAME_PROJECT_LIST_EVENT,
  createAndActivateGameProject,
  getOrCreateActiveGameProject,
  projectReadiness,
  readAllGameProjects,
  switchActiveGameProject,
  updateActiveGameProject,
} from "@/lib/game-project/client";

const tools: Array<{
  href: string;
  key: DesignStudioSectionName;
  image: string;
  label: string;
  eyebrow: string;
  description: string;
  output: string;
}> = [
  { href: "/story", key: "story", image: "/cards/story.png", label: "Story", eyebrow: "Narrative", description: "Build the premise, conflict, story structure, stakes, and endings.", output: "Story blueprint" },
  { href: "/characters", key: "characters", image: "/cards/characters.png", label: "Characters", eyebrow: "Cast", description: "Create game-ready heroes, rivals, motives, relationships, and arcs.", output: "Character set" },
  { href: "/world", key: "world", image: "/cards/world.png", label: "World", eyebrow: "Environment", description: "Design the setting, locations, routes, factions, rules, and visual identity.", output: "World plan" },
  { href: "/quests", key: "quests", image: "/cards/quests.png", label: "Quests", eyebrow: "Gameplay", description: "Turn the concept into objectives, rewards, choices, and consequences.", output: "Quest architecture" },
  { href: "/dialogue", key: "dialogue", image: "/cards/dialogue.png", label: "Dialogue", eyebrow: "Conversation", description: "Write cinematic conversations with voices, emotions, branches, and outcomes.", output: "Dialogue scenes" },
  { href: "/mentor", key: "mentor", image: "/cards/ai-mentor.png", label: "AI Producer", eyebrow: "Review", description: "Check scope, feasibility, risks, priorities, and production readiness.", output: "Production review" },
];

function sectionCount(project: GameProject | null, key: DesignStudioSectionName) {
  if (!project) return 0;
  const value = project.designStudio[key];
  return Array.isArray(value) ? value.length : value ? 1 : 0;
}

export default function DesignStudioPage() {
  const [project, setProject] = useState<GameProject | null>(null);
  const [projects, setProjects] = useState<GameProject[]>([]);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [saved, setSaved] = useState(false);

  function refresh() {
    const active = getOrCreateActiveGameProject();
    setProject(active);
    setProjects(readAllGameProjects());
    setTitle(active.title);
    setSummary(active.summary);
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(refresh);
    const handleProject = (event: Event) => {
      const next = (event as CustomEvent<GameProject>).detail || getOrCreateActiveGameProject();
      setProject(next);
      setProjects(readAllGameProjects());
      setTitle(next.title);
      setSummary(next.summary);
    };
    const handleList = () => setProjects(readAllGameProjects());
    window.addEventListener(GAME_PROJECT_EVENT, handleProject);
    window.addEventListener(GAME_PROJECT_LIST_EVENT, handleList);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(GAME_PROJECT_EVENT, handleProject);
      window.removeEventListener(GAME_PROJECT_LIST_EVENT, handleList);
    };
  }, []);

  const readiness = useMemo(() => projectReadiness(project), [project]);

  function saveProjectBrief() {
    const next = updateActiveGameProject((current) => ({
      ...current,
      title: title.trim() || "Untitled Game Project",
      summary: summary.trim(),
      designStudio: {
        ...current.designStudio,
        gdd: null,
      },
    }));
    setProject(next);
    setProjects(readAllGameProjects());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  }

  function createProject() {
    const next = createAndActivateGameProject(newTitle.trim() || "Untitled Game Project");
    setProject(next);
    setProjects(readAllGameProjects());
    setTitle(next.title);
    setSummary("");
    setNewTitle("");
    setNewProjectOpen(false);
  }

  function selectProject(projectId: string) {
    const next = switchActiveGameProject(projectId);
    if (!next) return;
    setProject(next);
    setTitle(next.title);
    setSummary(next.summary);
    setProjects(readAllGameProjects());
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05040a] pb-24 pt-28 text-white sm:pt-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_8%,rgba(124,58,237,.18),transparent_30%),radial-gradient(circle_at_82%_20%,rgba(34,211,238,.10),transparent_28%),radial-gradient(circle_at_50%_90%,rgba(217,70,239,.08),transparent_34%)]" />
      <div className="gf-hero-grid pointer-events-none absolute inset-0 opacity-30" />

      <div className="relative mx-auto w-full max-w-[1480px] px-5 sm:px-8">
        <section className="rounded-[32px] border border-white/10 bg-[#0a0812]/88 p-5 shadow-[0_30px_100px_rgba(0,0,0,.42)] backdrop-blur-2xl sm:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-300">Design Studio</p>
              <h1 className="mt-3 text-4xl font-black tracking-[-.04em] sm:text-5xl">Create the game plan without the clutter.</h1>
              <p className="mt-4 max-w-2xl leading-7 text-zinc-400">Open one tool at a time. Generate the result. Edit it. Save it. Every completed section stays connected to this project.</p>
            </div>

            <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(220px,1fr)_auto]">
              <label className="min-w-0">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Active project</span>
                <select value={project?.id || ""} onChange={(event) => selectProject(event.target.value)} className="h-12 w-full rounded-2xl border border-white/10 bg-black/35 px-4 font-bold text-white outline-none focus:border-violet-300/50">
                  {projects.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => setNewProjectOpen(true)} className="mt-auto h-12 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 px-5 font-black shadow-[0_12px_34px_rgba(124,58,237,.25)] transition hover:-translate-y-0.5">+ New Project</button>
            </div>
          </div>

          <div className="mt-7 grid gap-5 border-t border-white/[0.08] pt-6 lg:grid-cols-[1fr_1.4fr_230px] lg:items-end">
            <label>
              <span className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Project title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 font-bold outline-none focus:border-cyan-300/45" />
            </label>
            <label>
              <span className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Core concept</span>
              <input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Describe the game in one clear sentence" className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 outline-none placeholder:text-zinc-650 focus:border-cyan-300/45" />
            </label>
            <button type="button" onClick={saveProjectBrief} className="h-12 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.08] px-5 font-black text-cyan-100 transition hover:bg-cyan-300/[0.14]">{saved ? "Saved" : "Save project"}</button>
          </div>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool, index) => {
            const count = sectionCount(project, tool.key);
            const complete = count > 0;
            return (
              <Link key={tool.href} href={tool.href} className="group overflow-hidden rounded-[28px] border border-white/10 bg-[#0a0812]/88 shadow-[0_24px_70px_rgba(0,0,0,.34)] transition duration-300 hover:-translate-y-1.5 hover:border-violet-300/35">
                <div className="relative h-64 overflow-hidden bg-[#0f0f18]">
  <Image
    src={tool.image}
    alt={tool.label}
    fill
    sizes="(max-width: 768px) 100vw, 33vw"
    className="object-cover p-3 transition duration-700 group-hover:scale-105"
    priority={index < 3}
  />
  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0812] via-transparent to-transparent" />
  <span
    className={`absolute right-4 top-4 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${
      complete
        ? "border-emerald-300/25 bg-emerald-300/12 text-emerald-100"
        : "border-white/15 bg-black/45 text-zinc-300"
    }`}
  >
    {complete ? "Saved" : "Ready"}
  </span>
</div>
                <div className="p-6">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">{tool.eyebrow}</p>
                  <div className="mt-2 flex items-center justify-between gap-4"><h2 className="text-2xl font-black">{tool.label}</h2><span className="text-zinc-500 transition group-hover:translate-x-1 group-hover:text-white">→</span></div>
                  <p className="mt-3 min-h-14 leading-7 text-zinc-400">{tool.description}</p>
                  <div className="mt-5 border-t border-white/[0.08] pt-4 text-xs font-bold text-zinc-500">{complete ? `${count} saved result${count === 1 ? "" : "s"}` : `Output: ${tool.output}`}</div>
                </div>
              </Link>
            );
          })}
        </section>

        <section className="mt-8 rounded-[30px] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-xl sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-4"><p className="font-black">Project completion</p><span className="text-sm font-black text-cyan-200">{readiness.completed}/{readiness.total}</span></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 transition-[width] duration-700" style={{ width: `${readiness.percent}%` }} /></div>
              <p className="mt-3 text-sm text-zinc-500">The final GDD is not another Design Studio task. It is assembled automatically from these completed sections at the production stage.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/production-intelligence" className="inline-flex h-12 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-300/[0.09] px-5 font-black text-violet-100">Production</Link>
              <Link href="/team-workspace" className="inline-flex h-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.08] px-5 font-black text-cyan-100">Team handoff</Link>
              <Link href="/projects" className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-5 font-black">All projects</Link>
            </div>
          </div>
        </section>
      </div>

      {newProjectOpen ? (
        <div className="fixed inset-0 z-[300] grid place-items-center bg-black/75 p-5 backdrop-blur-lg" role="dialog" aria-modal="true" aria-label="Create a new project">
          <div className="w-full max-w-lg rounded-[30px] border border-violet-300/25 bg-[#0b0814] p-6 shadow-[0_40px_120px_rgba(0,0,0,.65)] sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">New project</p>
            <h2 className="mt-3 text-3xl font-black">Start a clean workspace</h2>
            <p className="mt-3 leading-7 text-zinc-400">Your current project stays saved. The new project gets its own story, characters, world, quests, dialogue, production plan, and final GDD.</p>
            <input autoFocus value={newTitle} onChange={(event) => setNewTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") createProject(); }} placeholder="Project name" className="mt-6 h-14 w-full rounded-2xl border border-white/10 bg-black/35 px-5 text-lg font-bold outline-none focus:border-violet-300/55" />
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setNewProjectOpen(false)} className="h-12 flex-1 rounded-2xl border border-white/10 bg-white/[0.04] font-bold text-zinc-300">Cancel</button>
              <button type="button" onClick={createProject} className="h-12 flex-1 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 font-black">Create project</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
