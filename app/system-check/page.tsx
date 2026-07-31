"use client";

import Link from "next/link";
import { useState } from "react";

const routes = [
  ["Home", "/"],
  ["Project Library", "/projects"],
  ["Design Studio", "/design-studio"],
  ["Production", "/production-intelligence"],
  ["Team Handoff", "/team-workspace"],
  ["Final GDD", "/gdd-export"],
  ["Dialogue Studio", "/dialogue"],
  ["Health API", "/api/health"],
] as const;

type Status = "idle" | "checking" | "ok" | "failed";

export default function SystemCheckPage() {
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [running, setRunning] = useState(false);

  async function runCheck() {
    setRunning(true);
    const next: Record<string, Status> = {};
    for (const [, href] of routes) {
      next[href] = "checking";
      setStatus({ ...next });
      try {
        const response = await fetch(href, { method: "GET", cache: "no-store", redirect: "follow" });
        next[href] = response.ok ? "ok" : "failed";
      } catch {
        next[href] = "failed";
      }
      setStatus({ ...next });
    }
    setRunning(false);
  }

  const completed = routes.filter(([, href]) => status[href] === "ok").length;

  return (
    <main className="relative min-h-screen overflow-hidden px-5 pb-24 pt-28 text-white sm:px-8 sm:pt-32">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,.14),transparent_30%),radial-gradient(circle_at_80%_30%,rgba(139,92,246,.18),transparent_34%)]" />
      <div className="mx-auto w-full max-w-5xl">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Exhibition reliability</p>
        <h1 className="mt-3 text-5xl font-black tracking-[-.04em]">GameForge system check</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-400">Run this page after installation to confirm that every important route responds. It helps distinguish a real route problem from an old server, wrong folder, or cached browser tab.</p>

        <section className="mt-9 rounded-[30px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-black">Verified routes</p>
              <p className="mt-1 text-sm text-zinc-500">{completed}/{routes.length} responding in this browser session</p>
            </div>
            <button type="button" disabled={running} onClick={runCheck} className="h-12 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 px-6 font-black text-white transition hover:-translate-y-1 disabled:cursor-wait disabled:opacity-70">{running ? "Checking routes..." : "Run route check"}</button>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {routes.map(([label, href]) => {
              const state = status[href] || "idle";
              return (
                <Link key={href} href={href} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:border-cyan-300/30 hover:bg-white/[0.05]">
                  <div><p className="font-black text-white">{label}</p><p className="mt-1 text-xs text-zinc-600">{href}</p></div>
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${state === "ok" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : state === "failed" ? "border-rose-300/20 bg-rose-300/10 text-rose-100" : state === "checking" ? "border-amber-300/20 bg-amber-300/10 text-amber-100" : "border-white/10 bg-white/[0.04] text-zinc-500"}`}>{state}</span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
