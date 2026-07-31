"use client";

import Link from "next/link";
import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import type { GameProject } from "@/app/types/game-project";
import { GAME_PROJECT_EVENT, getOrCreateActiveGameProject } from "@/lib/game-project/client";
import {
  PRODUCTION_BUDGET_OPTIONS,
  PRODUCTION_SCOPE_OPTIONS,
  buildProductionPlan,
  productionPlanIsCurrent,
  projectHasProductionInputs,
  readProductionPlan,
  saveProductionPlan,
  type ProductionBudget,
  type ProductionPlan,
  type ProductionScope,
} from "@/lib/production/plan";

function durationLabel(weeks: number) {
  if (weeks < 8) return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
  const months = Math.max(1, Math.round(weeks / 4.3));
  return `${months} ${months === 1 ? "month" : "months"}`;
}

export default function ProductionIntelligencePage() {
  const [project, setProject] = useState<GameProject | null>(null);
  const [scope, setScope] = useState<ProductionScope>("Exhibition Prototype");
  const [budget, setBudget] = useState<ProductionBudget>("Standard");
  const [plan, setPlan] = useState<ProductionPlan | null>(null);
  const [stalePlanFound, setStalePlanFound] = useState(false);

  useEffect(() => {
    const loadProject = (next: GameProject) => {
      setProject(next);
      const saved = readProductionPlan(next);
      const current = productionPlanIsCurrent(next, saved);
      setPlan(current ? saved : null);
      setStalePlanFound(Boolean(saved && !current));
      if (current && saved) {
        setScope(saved.scope);
        setBudget(saved.budget);
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

  function generatePlan() {
    if (!project || !projectHasProductionInputs(project)) return;
    const next = buildProductionPlan(project, scope, budget);
    saveProductionPlan(next);
    setPlan(next);
    setStalePlanFound(false);
  }

  if (!project) {
    return <main className="grid min-h-screen place-items-center pt-24 text-white"><p className="text-zinc-400">Preparing Production…</p></main>;
  }

  const hasInputs = projectHasProductionInputs(project);
  const detectedSections = plan?.sourceSections ?? [
    project.designStudio.story ? "Story" : "",
    project.designStudio.characters.length ? "Characters" : "",
    project.designStudio.world ? "World" : "",
    project.designStudio.quests.length ? "Quests" : "",
    project.designStudio.dialogue.length ? "Dialogue" : "",
  ].filter((section): section is string => Boolean(section));

  return (
    <main className="relative min-h-screen overflow-hidden px-5 pb-24 pt-28 text-white sm:px-8 sm:pt-32">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_12%,rgba(16,185,129,.12),transparent_32%),radial-gradient(circle_at_85%_18%,rgba(6,182,212,.12),transparent_30%),radial-gradient(circle_at_55%_80%,rgba(124,58,237,.13),transparent_32%)]" />
      <div className="mx-auto w-full max-w-[1480px]">
        <section className="grid gap-8 lg:grid-cols-[1fr_410px] lg:items-end">
          <div>
            <div className="inline-flex items-center rounded-full border border-emerald-300/20 bg-emerald-300/[0.07] px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-100">Production planning</div>
            <h1 className="mt-6 max-w-5xl text-5xl font-black leading-[.98] tracking-tight sm:text-6xl lg:text-7xl">A production plan built only from <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-violet-300 bg-clip-text text-transparent">your generated project.</span></h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-400">GameForge will not invent a team size or schedule for an empty project. Generate real design content first, then create a production estimate from the connected sections.</p>
          </div>
          <aside className="rounded-[28px] border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm font-bold text-zinc-500">Active project</p>
            <h2 className="mt-3 text-2xl font-black">{project.title}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-500">{project.summary || "No generated project summary yet."}</p>
            <Link href="/design-studio" className="mt-5 block rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm font-black">Return to Design Studio</Link>
          </aside>
        </section>

        {!hasInputs ? (
          <section className="mt-12 rounded-[34px] border border-dashed border-white/12 bg-white/[0.025] px-6 py-20 text-center sm:px-10">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.08] text-3xl">⌁</div>
            <h2 className="mt-6 text-3xl font-black">No production data yet</h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-500">Nothing is estimated because this project has no generated Story, Character, World, Quest, or Dialogue content. Complete at least one Design Studio section and return here.</p>
            <Link href="/design-studio" className="mt-7 inline-flex rounded-2xl bg-gradient-to-r from-emerald-600 via-cyan-600 to-violet-600 px-6 py-3.5 font-black">Open Design Studio</Link>
          </section>
        ) : (
          <section className="mt-10 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="h-fit rounded-[30px] border border-white/10 bg-[#0b0b13]/76 p-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Plan settings</p>
              <div className="mt-6">
                <label htmlFor="scope" className="mb-2 block text-sm font-bold text-zinc-300">Target scope</label>
                <select id="scope" value={scope} onChange={(event: ChangeEvent<HTMLSelectElement>) => setScope(event.target.value as ProductionScope)} className="w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3.5 text-white outline-none focus:border-cyan-300/40">
                  {PRODUCTION_SCOPE_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>
              <div className="mt-5">
                <label htmlFor="budget" className="mb-2 block text-sm font-bold text-zinc-300">Resource level</label>
                <select id="budget" value={budget} onChange={(event: ChangeEvent<HTMLSelectElement>) => setBudget(event.target.value as ProductionBudget)} className="w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3.5 text-white outline-none focus:border-cyan-300/40">
                  {PRODUCTION_BUDGET_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>

              <div className="mt-6 rounded-[22px] border border-white/10 bg-black/20 p-5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Detected project content</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {detectedSections.map((section) => <span key={section} className="rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-3 py-1.5 text-xs font-bold text-emerald-100">{section}</span>)}
                </div>
              </div>

              {stalePlanFound ? <p className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-4 text-sm leading-6 text-amber-100">The project changed after the previous estimate. Generate a new plan before using Production or Team Handoff.</p> : null}

              <button type="button" onClick={generatePlan} className="mt-6 w-full rounded-2xl bg-gradient-to-r from-emerald-600 via-cyan-600 to-violet-600 px-5 py-4 font-black shadow-[0_16px_48px_rgba(6,182,212,.18)]">
                {plan ? "Regenerate production plan" : "Generate production plan"}
              </button>
            </aside>

            {!plan ? (
              <div className="grid min-h-[560px] place-items-center rounded-[30px] border border-dashed border-white/12 bg-white/[0.02] p-8 text-center">
                <div>
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] text-3xl">＋</div>
                  <h2 className="mt-6 text-3xl font-black">Generate the real estimate</h2>
                  <p className="mx-auto mt-3 max-w-xl leading-7 text-zinc-500">No team count, duration, asset number, role assignment, or milestone is displayed until you generate a plan from the current project data.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["Recommended team", `${plan.teamCount} ${plan.teamCount === 1 ? "person" : "people"}`, "Calculated from required roles"],
                    ["Estimated duration", durationLabel(plan.durationWeeks), `${plan.durationWeeks} production weeks`],
                    ["Estimated workload", `${plan.assetCount} assets`, "Based on generated content and scope"],
                    ["QA allocation", `${plan.qaWeeks} ${plan.qaWeeks === 1 ? "week" : "weeks"}`, "Testing and final validation"],
                  ].map(([label, value, detail]) => (
                    <article key={label} className="rounded-[24px] border border-white/9 bg-white/[0.035] p-5">
                      <p className="text-xs font-black uppercase tracking-[0.15em] text-zinc-500">{label}</p>
                      <p className="mt-5 text-3xl font-black text-white">{value}</p>
                      <p className="mt-2 text-xs leading-5 text-zinc-500">{detail}</p>
                    </article>
                  ))}
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <section className="rounded-[30px] border border-white/10 bg-white/[0.025] p-6">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">Required team</p>
                      <span className="rounded-full border border-violet-300/15 bg-violet-300/[0.07] px-3 py-1 text-xs font-black text-violet-100">{plan.teamCount} total</span>
                    </div>
                    <div className="mt-6 space-y-3">
                      {plan.roles.map((item) => (
                        <article key={item.role} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                          <div className="flex items-center justify-between gap-4"><strong>{item.role}</strong><span className="rounded-full bg-violet-300/10 px-3 py-1 text-sm font-black text-violet-200">{item.count}</span></div>
                          <p className="mt-2 text-sm leading-6 text-zinc-500">{item.reason}</p>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-[30px] border border-white/10 bg-white/[0.025] p-6">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Production phases</p>
                    <div className="mt-6 space-y-5">
                      {plan.phases.map((phase, index) => (
                        <div key={phase.label} className="grid grid-cols-[42px_minmax(0,1fr)] gap-4">
                          <span className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/18 bg-cyan-300/[0.07] text-xs font-black text-cyan-200">0{index + 1}</span>
                          <div><div className="flex flex-wrap items-center gap-3"><p className="font-black">{phase.label}</p><span className="text-xs font-bold text-cyan-200">{phase.duration}</span></div><p className="mt-1 text-sm leading-6 text-zinc-500">{phase.detail}</p></div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <section className="rounded-[30px] border border-rose-300/12 bg-rose-300/[0.035] p-6">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-200">Current risks</p>
                    <div className="mt-5 space-y-4">{plan.risks.map((risk) => <p key={risk} className="flex gap-3 text-sm leading-7 text-zinc-300"><span className="font-black text-rose-300">!</span><span>{risk}</span></p>)}</div>
                  </section>
                  <section className="rounded-[30px] border border-emerald-300/12 bg-emerald-300/[0.035] p-6">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Planned deliverables</p>
                    <div className="mt-5 grid gap-3">{plan.deliverables.map((item) => <div key={item} className="flex gap-3 rounded-2xl border border-white/8 bg-black/15 p-3 text-sm text-zinc-300"><span className="text-emerald-300">✓</span><span>{item}</span></div>)}</div>
                  </section>
                </div>

                <div className="flex flex-col gap-5 rounded-[28px] border border-white/10 bg-white/[0.035] p-6 lg:flex-row lg:items-center lg:justify-between">
                  <div><p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-300">Next step</p><p className="mt-2 text-lg font-black">The Team Handoff will now use this generated production plan.</p></div>
                  <Link href="/team-workspace" className="shrink-0 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 px-5 py-3 text-center text-sm font-black">Open Team Handoff</Link>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
