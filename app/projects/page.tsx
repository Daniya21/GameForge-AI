"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { GameProject } from "@/app/types/game-project";
import {
  GAME_PROJECT_EVENT,
  GAME_PROJECT_LIST_EVENT,
  createAndActivateGameProject,
  deleteGameProject,
  duplicateGameProject,
  getOrCreateActiveGameProject,
  projectReadiness,
  readAllGameProjects,
  switchActiveGameProject,
} from "@/lib/game-project/client";

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<GameProject[]>([]);
  const [activeId, setActiveId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  function refresh() {
    const active = getOrCreateActiveGameProject();
    setProjects(readAllGameProjects());
    setActiveId(active.id);
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(refresh);
    const handler = () => refresh();
    window.addEventListener(GAME_PROJECT_EVENT, handler);
    window.addEventListener(GAME_PROJECT_LIST_EVENT, handler);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(GAME_PROJECT_EVENT, handler);
      window.removeEventListener(GAME_PROJECT_LIST_EVENT, handler);
    };
  }, []);

  const totalCompleted = useMemo(() => projects.filter((project) => projectReadiness(project).percent === 100).length, [projects]);

  function createProject() {
    const project = createAndActivateGameProject(newTitle.trim() || "Untitled Game Project");
    setNewTitle("");
    setCreating(false);
    setActiveId(project.id);
    setProjects(readAllGameProjects());
  }

  function openProject(projectId: string) {
    const project = switchActiveGameProject(projectId);
    if (project) setActiveId(project.id);
  }

  function duplicate(projectId: string) {
    const project = duplicateGameProject(projectId);
    if (project) {
      setActiveId(project.id);
      setProjects(readAllGameProjects());
    }
  }

  function remove(project: GameProject) {
    if (!window.confirm(`Delete ${project.title}? This cannot be undone.`)) return;
    const next = deleteGameProject(project.id);
    setProjects(readAllGameProjects());
    if (next) setActiveId(next.id);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05040a] pb-24 pt-28 text-white sm:pt-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(124,58,237,.18),transparent_30%),radial-gradient(circle_at_86%_16%,rgba(34,211,238,.10),transparent_28%)]" />
      <div className="relative mx-auto w-full max-w-[1450px] px-5 sm:px-8">
        <section className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Project library</p>
            <h1 className="mt-4 text-5xl font-black tracking-[-.045em] sm:text-6xl">Every game gets its own workspace.</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-400">Create, reopen, duplicate, and manage projects without overwriting previous work. Each project keeps its own complete Design Studio and production data.</p>
          </div>
          <button type="button" onClick={() => setCreating(true)} className="h-14 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 px-7 font-black shadow-[0_18px_50px_rgba(124,58,237,.3)] transition hover:-translate-y-1">+ Create New Project</button>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Projects</p><p className="mt-2 text-4xl font-black">{projects.length}</p></div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Design complete</p><p className="mt-2 text-4xl font-black text-emerald-200">{totalCompleted}</p></div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Storage</p><p className="mt-2 text-xl font-black text-cyan-200">Saved locally</p></div>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const readiness = projectReadiness(project);
            const active = project.id === activeId;
            return (
              <article key={project.id} className={`rounded-[28px] border p-6 shadow-[0_24px_70px_rgba(0,0,0,.34)] ${active ? "border-cyan-300/40 bg-cyan-300/[0.06]" : "border-white/10 bg-[#0a0812]/88"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{active ? "Active project" : "Saved project"}</p><h2 className="mt-2 truncate text-2xl font-black">{project.title}</h2></div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${readiness.percent === 100 ? "bg-emerald-300/12 text-emerald-100" : "bg-violet-300/10 text-violet-100"}`}>{readiness.completed}/{readiness.total}</span>
                </div>
                <p className="mt-4 min-h-14 line-clamp-2 leading-7 text-zinc-400">{project.summary || "No project summary yet. Open Design Studio to define the concept."}</p>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400" style={{ width: `${readiness.percent}%` }} /></div>
                <div className="mt-3 flex justify-between text-xs text-zinc-500"><span>{readiness.percent}% complete</span><span>Updated {formatDate(project.updatedAt)}</span></div>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => openProject(project.id)} className="h-11 rounded-xl border border-white/10 bg-white/[0.05] font-black">{active ? "Selected" : "Select"}</button>
                  <Link href="/design-studio" onClick={() => openProject(project.id)} className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 font-black">Open Studio</Link>
                  <button type="button" onClick={() => duplicate(project.id)} className="h-10 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05] text-sm font-bold text-cyan-100">Duplicate</button>
                  <button type="button" onClick={() => remove(project)} className="h-10 rounded-xl border border-rose-300/15 bg-rose-300/[0.05] text-sm font-bold text-rose-100">Delete</button>
                </div>
              </article>
            );
          })}
        </section>
      </div>

      {creating ? (
        <div className="fixed inset-0 z-[300] grid place-items-center bg-black/75 p-5 backdrop-blur-lg">
          <div className="w-full max-w-lg rounded-[30px] border border-violet-300/25 bg-[#0b0814] p-7 shadow-[0_40px_120px_rgba(0,0,0,.65)]">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">Create project</p>
            <h2 className="mt-3 text-3xl font-black">Name your new game</h2>
            <input autoFocus value={newTitle} onChange={(event) => setNewTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") createProject(); }} placeholder="New game project" className="mt-6 h-14 w-full rounded-2xl border border-white/10 bg-black/35 px-5 text-lg font-bold outline-none focus:border-violet-300/55" />
            <div className="mt-5 flex gap-3"><button type="button" onClick={() => setCreating(false)} className="h-12 flex-1 rounded-2xl border border-white/10 bg-white/[0.04] font-bold">Cancel</button><button type="button" onClick={createProject} className="h-12 flex-1 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 font-black">Create</button></div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
