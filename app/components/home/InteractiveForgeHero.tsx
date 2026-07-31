"use client";

import Image from "next/image";
import Link from "next/link";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";


type PointerState = { x: number; y: number };

export default function InteractiveForgeHero() {
  const frame = useRef<number | null>(null);
  const pending = useRef<PointerState>({ x: 0, y: 0 });
  const [pointer, setPointer] = useState<PointerState>({ x: 0, y: 0 });
  const [active, setActive] = useState("Connected design intelligence online");

  useEffect(() => () => {
    if (frame.current !== null) window.cancelAnimationFrame(frame.current);
  }, []);

  function updatePointer(event: ReactPointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    pending.current = {
      x: ((event.clientX - rect.left) / rect.width - 0.5) * 2,
      y: ((event.clientY - rect.top) / rect.height - 0.5) * 2,
    };
    if (frame.current !== null) return;
    frame.current = window.requestAnimationFrame(() => {
      setPointer(pending.current);
      frame.current = null;
    });
  }

  function resetPointer() {
    pending.current = { x: 0, y: 0 };
    setPointer({ x: 0, y: 0 });
  }

  return (
    <section
      onPointerMove={updatePointer}
      onPointerLeave={resetPointer}
      className="relative isolate flex min-h-[calc(100vh-76px)] items-center overflow-hidden border-b border-white/[0.08] pt-[76px]"
      aria-label="GameForge AI interactive introduction"
    >
      <div className="absolute inset-0 -z-30 bg-[#05040b]" />
      <div
        className="absolute -inset-8 -z-20 transition-transform duration-300 ease-out"
        style={{ transform: `translate3d(${pointer.x * -12}px, ${pointer.y * -10}px, 0) scale(1.045)` }}
      >
        <Image
          src="/gameforge-hero-bg.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-75"
        />
      </div>
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(6,4,18,.08),rgba(4,3,10,.38)_42%,rgba(3,2,8,.88)_100%)]" />
      <div className="gf-hero-scan absolute inset-0 -z-10 opacity-45" />

      <div className="mx-auto w-full max-w-[1480px] px-5 py-16 text-center sm:px-8 lg:py-24">
        <div
          className="mx-auto max-w-5xl transition-transform duration-300 ease-out"
          style={{ transform: `translate3d(${pointer.x * 6}px, ${pointer.y * 4}px, 0)` }}
        >
          <div className="mx-auto inline-flex items-center gap-3 rounded-full border border-violet-300/30 bg-violet-300/[0.08] px-5 py-2 text-[11px] font-black uppercase tracking-[0.19em] text-violet-100 shadow-[0_0_34px_rgba(139,92,246,.15)] backdrop-blur-xl">
            <span className="relative h-2.5 w-2.5 rounded-full bg-violet-300 shadow-[0_0_14px_rgba(196,181,253,.95)]">
              <span className="absolute inset-0 animate-ping rounded-full bg-violet-300/50" />
            </span>
            AI-powered game pre-production studio
          </div>

          <h1 className="mt-8 text-5xl font-black leading-[.96] tracking-[-.05em] text-white sm:text-7xl lg:text-[92px]">
            Turn One Idea Into
            <span className="mt-3 block bg-gradient-to-r from-violet-300 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent drop-shadow-[0_0_32px_rgba(192,132,252,.2)]">
              a Complete Game Design System
            </span>
          </h1>

          <div className="mx-auto mt-7 h-px max-w-5xl bg-gradient-to-r from-violet-500 via-fuchsia-400 to-cyan-300 shadow-[0_0_16px_rgba(34,211,238,.35)]" />

          <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-zinc-300 sm:text-xl">
            Connect story, characters, world design, quests, dialogue, production planning, team handoff, and final documentation inside one clean project workspace.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/design-studio"
              className="group inline-flex h-14 min-w-60 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 px-7 font-black text-white shadow-[0_18px_54px_rgba(139,92,246,.35)] transition hover:-translate-y-1 hover:shadow-[0_22px_64px_rgba(139,92,246,.48)]"
            >
              Enter Design Studio
              <span className="ml-3 transition-transform group-hover:translate-x-1">→</span>
            </Link>
            <Link
              href="/projects"
              className="inline-flex h-14 min-w-60 items-center justify-center rounded-2xl border border-white/15 bg-black/30 px-7 font-black text-white backdrop-blur-xl transition hover:-translate-y-1 hover:border-cyan-300/40 hover:bg-white/[0.08]"
            >
              Open Project Library
            </Link>
          </div>

          <div className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-zinc-400">
            <span>✓ Connected AI agents</span>
            <span>✓ Human-approved revisions</span>
            <span>✓ Development-ready handoff</span>
          </div>
        </div>

        <div className="mx-auto mt-12 flex max-w-3xl items-center justify-center gap-3 rounded-2xl border border-white/[0.08] bg-black/25 px-5 py-3 text-xs font-bold text-zinc-300 backdrop-blur-xl sm:w-fit">
          <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,.9)]" />
          <span aria-live="polite">{active}</span>
          <span className="hidden text-zinc-600 sm:inline">Move your cursor across the forge</span>
        </div>
      </div>
    </section>
  );
}
