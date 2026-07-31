import Link from "next/link";

const principles = [
  ["Human-directed", "AI proposes structure, risks, and revisions. A human creative director reviews and approves important changes."],
  ["Connected", "Story, characters, world, quests, dialogue, scope, tasks, and documentation share one project context."],
  ["Production-aware", "GameForge turns creative ambition into milestones, role requirements, acceptance criteria, and an MVP plan."],
  ["Honest by design", "The platform supports pre-production. It does not claim to replace game engines, professional teams, or production QA."],
];

export default function AboutPage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-5 pb-24 pt-28 text-white sm:px-8 sm:pt-32">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_12%,rgba(124,58,237,.18),transparent_34%),radial-gradient(circle_at_82%_20%,rgba(6,182,212,.12),transparent_30%)]" />
      <div className="mx-auto w-full max-w-6xl">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">About GameForge AI</p>
        <h1 className="mt-5 text-5xl font-black leading-[.98] tracking-tight sm:text-6xl">An AI-powered game pre-production and design intelligence studio.</h1>
        <p className="mt-7 max-w-4xl text-xl leading-9 text-zinc-400">GameForge helps creators transform an early idea into a structured, connected, reviewable, and development-ready plan. It centralizes creative design, documentation, scenario analysis, production planning, and team handoff before expensive implementation begins.</p>

        <section className="mt-12 grid gap-5 md:grid-cols-2">
          <article className="rounded-[30px] border border-rose-300/14 bg-rose-300/[0.035] p-7">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-200">The problem</p>
            <h2 className="mt-3 text-3xl font-black">Pre-production information becomes fragmented.</h2>
            <p className="mt-4 leading-7 text-zinc-400">Writers, artists, designers, engineers, and stakeholders may work from different notes and assumptions. When one idea changes, related documents and tasks are often updated manually, creating contradictions, delays, and wasted effort.</p>
          </article>
          <article className="rounded-[30px] border border-emerald-300/14 bg-emerald-300/[0.035] p-7">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">The solution</p>
            <h2 className="mt-3 text-3xl font-black">One connected source of truth.</h2>
            <p className="mt-4 leading-7 text-zinc-400">GameForge coordinates specialized design agents, stores approved decisions in the active project, checks production readiness, and prepares professional documentation and team tasks.</p>
          </article>
        </section>

        <section className="mt-12">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">Design principles</p>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {principles.map(([title, text]) => (
              <article key={title} className="rounded-[28px] border border-white/10 bg-white/[0.035] p-7">
                <h2 className="text-2xl font-black">{title}</h2>
                <p className="mt-4 leading-7 text-zinc-400">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-[32px] border border-cyan-300/14 bg-cyan-300/[0.035] p-7 sm:p-9">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Relationship with development tools</p>
          <h2 className="mt-4 text-3xl font-black">The bridge between idea and implementation.</h2>
          <p className="mt-5 text-lg leading-8 text-zinc-400">GameForge prepares design documents, production tasks, risks, milestones, and handoff guidance for teams working in Unity, Unreal Engine, Godot, or another development stack. Direct engine integration should only be claimed when a real plugin or compatible export pipeline is available.</p>
        </section>

        <section className="mt-12 rounded-[32px] border border-amber-300/14 bg-amber-300/[0.035] p-7 sm:p-9">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">Scope and limitations</p>
          <p className="mt-4 text-lg leading-8 text-zinc-400">GameForge supports planning and pre-production. Generated recommendations require human review. Programming, production art, animation, level construction, optimization, accessibility implementation, security, testing, certification, and commercial release remain professional development responsibilities.</p>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/design-studio" className="rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 px-6 py-3 font-black">Open Design Studio</Link>
          <Link href="/team-workspace" className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-3 font-black">See Team Handoff</Link>
          <Link href="/projects" className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-3 font-black">Open Project Library</Link>
        </div>
      </div>
    </main>
  );
}
