"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { GameProject } from "@/app/types/game-project";
import { GAME_PROJECT_EVENT, getOrCreateActiveGameProject } from "@/lib/game-project/client";
import { loadJudgeDemoProject } from "@/lib/plan-b/demo-project";

const beats = [
  {
    speaker: "Marcus Venn",
    role: "Crew leader",
    text: "Tomorrow, nobody improvises. We walk in as four people and leave as one decision.",
    choices: [
      { label: "Trust the plan", effect: { trust: 15, suspicion: -8, evidence: 0 }, response: "Marcus relaxes. Ilya notices. Sana says nothing." },
      { label: "Question the last-minute route change", effect: { trust: -8, suspicion: 18, evidence: 8 }, response: "Marcus answers too quickly. A hidden inconsistency enters the evidence log." },
      { label: "Signal Sana privately", effect: { trust: 0, suspicion: 12, evidence: 15 }, response: "Sana confirms that the bank's police liaison accessed the same route file." },
    ],
  },
  {
    speaker: "Sana Kade",
    role: "Bank insider",
    text: "There is a second authorization signature on the vault override. It was added from outside the bank.",
    choices: [
      { label: "Tell the whole crew", effect: { trust: 8, suspicion: 10, evidence: 12 }, response: "The room fractures. Marcus takes control of the conversation before anyone can inspect the file." },
      { label: "Keep it between us", effect: { trust: -2, suspicion: 15, evidence: 20 }, response: "A new objective unlocks: verify the external signature during the heist." },
      { label: "Delete the evidence", effect: { trust: 12, suspicion: -6, evidence: -15 }, response: "The crew remains stable, but the hidden operation becomes harder to prove." },
    ],
  },
  {
    speaker: "Nara Vale",
    role: "Player character",
    text: "The plan is still possible. The real question is whether we are robbing a bank or walking into somebody else's trap.",
    choices: [
      { label: "Proceed and expose Marcus in the vault", effect: { trust: -10, suspicion: 15, evidence: 18 }, response: "Final path selected: The Double Cross." },
      { label: "Abort and protect the crew", effect: { trust: 18, suspicion: 0, evidence: -5 }, response: "Final path selected: Broken Plan, Unbroken Crew." },
      { label: "Use the heist to trap both sides", effect: { trust: -12, suspicion: 20, evidence: 25 }, response: "Final path selected: Vault of Echoes." },
    ],
  },
];

function endingFor(trust: number, suspicion: number, evidence: number) {
  if (evidence >= 45 && suspicion >= 45) return { title: "Vault of Echoes", text: "Nara converts the heist into a controlled reveal. Marcus is exposed, the task force loses its clean arrest, and the crew escapes with proof instead of money." };
  if (trust >= 55) return { title: "Unbroken Crew", text: "The robbery is abandoned before the trap closes. The crew survives, but Marcus disappears with the operation still hidden." };
  return { title: "The Double Cross", text: "The vault opens, but loyalty collapses. Nara escapes with partial evidence while the crew splits under pressure." };
}

export default function PlayableScenePage() {
  const [project, setProject] = useState<GameProject | null>(null);
  const [step, setStep] = useState(0);
  const [trust, setTrust] = useState(40);
  const [suspicion, setSuspicion] = useState(20);
  const [evidence, setEvidence] = useState(10);
  const [log, setLog] = useState<string[]>([]);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setProject(getOrCreateActiveGameProject()));
    const onUpdate = (event: Event) => setProject((event as CustomEvent<GameProject>).detail ?? getOrCreateActiveGameProject());
    window.addEventListener(GAME_PROJECT_EVENT, onUpdate);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(GAME_PROJECT_EVENT, onUpdate);
    };
  }, []);

  const ending = useMemo(() => endingFor(trust, suspicion, evidence), [trust, suspicion, evidence]);
  const beat = beats[Math.min(step, beats.length - 1)];
  const demoActive = project?.title === "Vault of Echoes";

  function resetScene() {
    setStep(0);
    setTrust(40);
    setSuspicion(20);
    setEvidence(10);
    setLog([]);
    setComplete(false);
  }

  function choose(choice: (typeof beats)[number]["choices"][number]) {
    setTrust((value) => Math.max(0, Math.min(100, value + choice.effect.trust)));
    setSuspicion((value) => Math.max(0, Math.min(100, value + choice.effect.suspicion)));
    setEvidence((value) => Math.max(0, Math.min(100, value + choice.effect.evidence)));
    setLog((current) => [...current, choice.response]);
    if (step >= beats.length - 1) {
      setComplete(true);
    } else {
      setStep((value) => value + 1);
    }
  }

  function loadDemo() {
    setProject(loadJudgeDemoProject());
    resetScene();
  }

  if (!project) {
    return <main className="grid min-h-screen place-items-center pt-24 text-white"><p className="text-zinc-400">Loading playable scene…</p></main>;
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-5 pb-20 pt-28 text-white sm:px-8 sm:pt-32">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(5,4,13,.3),rgba(5,4,13,.94)),url('/gameforge-hero-bg.png')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(124,58,237,.22),transparent_34%),radial-gradient(circle_at_82%_25%,rgba(6,182,212,.12),transparent_30%)]" />
      </div>

      <div className="mx-auto w-full max-w-[1480px]">
        <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.26em] text-cyan-300">Playable narrative prototype</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">The Night Before — Vault of Echoes</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-400">A stable interactive judge scene connected to the built-in Design Studio project. Choices update relationships, suspicion, evidence, quest direction, and the ending.</p>
            {!demoActive ? <p className="mt-3 text-sm font-bold text-amber-200">Your active project is “{project.title}”. Load the judge demo to synchronize this scene with the active project.</p> : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={loadDemo} className="h-12 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] px-5 text-sm font-black text-cyan-100">Load judge demo</button>
            <button type="button" onClick={resetScene} className="h-12 rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-black">Restart scene</button>
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="overflow-hidden rounded-[34px] border border-white/10 bg-[#080611]/90 shadow-[0_34px_100px_rgba(0,0,0,.56)]">
            <div className="relative min-h-[620px]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_30%,rgba(124,58,237,.18),transparent_33%),linear-gradient(135deg,rgba(8,6,17,.2),rgba(8,6,17,.9))]" />
              <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:56px_56px]" />

              <div className="relative z-10 flex min-h-[620px] flex-col justify-between p-6 sm:p-8 lg:p-10">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-rose-400 shadow-[0_0_14px_rgba(251,113,133,.9)]" />
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Safehouse · 23:42 · Heist minus 8 hours</span>
                  </div>
                  <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">Scene {Math.min(step + 1, beats.length)}/{beats.length}</span>
                </div>

                {!complete ? (
                  <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center py-10">
                    <div className="grid gap-7 lg:grid-cols-[230px_minmax(0,1fr)] lg:items-center">
                      <div className="mx-auto flex h-56 w-48 flex-col items-center justify-center rounded-[30px] border border-violet-300/20 bg-gradient-to-b from-violet-500/20 via-fuchsia-500/10 to-black/30 shadow-[0_24px_60px_rgba(0,0,0,.35)]">
                        <div className="grid h-24 w-24 place-items-center rounded-full border border-white/12 bg-black/30 text-4xl font-black text-violet-200">{beat.speaker.split(" ").map((part) => part[0]).join("")}</div>
                        <p className="mt-5 text-lg font-black">{beat.speaker}</p>
                        <p className="mt-1 text-xs text-zinc-500">{beat.role}</p>
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-300">Live dialogue</p>
                        <blockquote className="mt-4 text-3xl font-black leading-[1.25] tracking-tight text-white sm:text-4xl">“{beat.text}”</blockquote>
                        <p className="mt-5 text-sm leading-7 text-zinc-500">Choose a response. GameForge updates the hidden narrative state and determines the next consequence.</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto flex max-w-3xl flex-1 flex-col items-center justify-center py-10 text-center">
                    <span className="grid h-20 w-20 place-items-center rounded-[26px] border border-cyan-300/20 bg-cyan-300/[0.08] text-3xl">✦</span>
                    <p className="mt-7 text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Ending generated from your choices</p>
                    <h2 className="mt-4 text-5xl font-black tracking-tight">{ending.title}</h2>
                    <p className="mt-6 text-lg leading-8 text-zinc-300">{ending.text}</p>
                    <div className="mt-8 flex flex-wrap justify-center gap-3">
                      <button type="button" onClick={resetScene} className="rounded-2xl bg-white px-6 py-3 font-black text-zinc-950">Replay scene</button>
                      <Link href="/design-studio" className="rounded-2xl border border-white/12 bg-white/[0.05] px-6 py-3 font-black">Return to Design Studio</Link>
                    </div>
                  </div>
                )}

                {!complete ? (
                  <div className="grid gap-3 lg:grid-cols-3">
                    {beat.choices.map((choice, index) => (
                      <button key={choice.label} type="button" onClick={() => choose(choice)} className="group rounded-[22px] border border-white/10 bg-black/35 p-5 text-left transition hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-cyan-300/[0.06]">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Choice {String.fromCharCode(65 + index)}</span>
                        <p className="mt-3 font-black leading-6 text-white">{choice.label}</p>
                        <p className="mt-3 text-xs text-zinc-600">Trust {choice.effect.trust >= 0 ? "+" : ""}{choice.effect.trust} · Suspicion {choice.effect.suspicion >= 0 ? "+" : ""}{choice.effect.suspicion} · Evidence {choice.effect.evidence >= 0 ? "+" : ""}{choice.effect.evidence}</p>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Live narrative state</p>
              <div className="mt-6 space-y-5">
                {[["Crew trust", trust, "from-violet-500 to-fuchsia-400"], ["Suspicion", suspicion, "from-amber-500 to-rose-400"], ["Evidence", evidence, "from-cyan-500 to-emerald-400"]].map(([label, value, gradient]) => (
                  <div key={String(label)}>
                    <div className="flex items-center justify-between text-sm"><span className="text-zinc-400">{label}</span><strong>{value}%</strong></div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8"><div className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`} style={{ width: `${value}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-300">Consequence log</p>
              <div className="mt-5 space-y-3">
                {log.length ? log.map((item, index) => <div key={`${item}-${index}`} className="rounded-2xl border border-white/8 bg-black/20 p-3 text-sm leading-6 text-zinc-400"><span className="mr-2 font-black text-fuchsia-300">0{index + 1}</span>{item}</div>) : <p className="text-sm leading-6 text-zinc-600">Your decisions will appear here and influence the final path.</p>}
              </div>
            </div>

            <div className="rounded-[28px] border border-emerald-300/14 bg-emerald-300/[0.045] p-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Why judges can play this</p>
              <p className="mt-4 text-sm leading-7 text-zinc-300">It validates the connected story, character, quest, and dialogue logic through choices and consequences without claiming to be a finished game.</p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
