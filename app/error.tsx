"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("GameForge route error", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#05040b] px-5 py-28 text-white">
      <section className="w-full max-w-2xl rounded-[32px] border border-rose-300/20 bg-rose-300/[0.055] p-8 text-center shadow-[0_32px_110px_rgba(0,0,0,.55)] backdrop-blur-2xl">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-rose-300/25 bg-rose-300/10 text-2xl text-rose-200">!</div>
        <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-rose-300">Workspace recovery</p>
        <h1 className="mt-3 text-3xl font-black">This page encountered an error.</h1>
        <p className="mt-4 leading-7 text-zinc-400">Your saved project remains in the browser. Retry the route first. When the problem continues, return to the Design Studio and reopen the agent.</p>
        {error.digest ? <p className="mt-3 text-xs text-zinc-600">Reference: {error.digest}</p> : null}
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={reset} className="h-12 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 font-black text-white">Try again</button>
          <a href="/design-studio" className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-6 font-black text-zinc-200">Open Design Studio</a>
        </div>
      </section>
    </main>
  );
}
