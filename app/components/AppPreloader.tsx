"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const BOOT_DURATION = 3800;
const EXIT_DURATION = 780;

const stages = [
  { at: 0, label: "Booting Creative Director", detail: "Opening the connected pre-production workspace" },
  { at: 22, label: "Synchronizing Agent Council", detail: "Linking story, characters, world, quests, and dialogue" },
  { at: 48, label: "Loading Project Workspace", detail: "Restoring saved game projects and creative decisions" },
  { at: 73, label: "Preparing Production Tools", detail: "Preparing production planning and team handoff" },
  { at: 93, label: "Studio Ready", detail: "Opening your GameForge pre-production command center" },
];

export default function AppPreloader() {
  const pathname = usePathname();
  const firstPath = useRef(pathname);
  const animationFrame = useRef<number | null>(null);
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [routeLoading, setRouteLoading] = useState(false);
  const [canSkip, setCanSkip] = useState(false);

  const stage = useMemo(() => [...stages].reverse().find((item) => progress >= item.at) || stages[0], [progress]);

  useEffect(() => {
    document.documentElement.dataset.gfReady = "false";
    document.body.style.overflow = "hidden";
    const started = performance.now();
    const skipTimer = window.setTimeout(() => setCanSkip(true), 1900);

    const tick = (now: number) => {
      const elapsed = now - started;
      const ratio = Math.min(1, elapsed / BOOT_DURATION);
      const next = Math.min(100, Math.round((1 - Math.pow(1 - ratio, 2.15)) * 100));
      setProgress(next);
      if (elapsed < BOOT_DURATION) {
        animationFrame.current = window.requestAnimationFrame(tick);
        return;
      }
      setProgress(100);
      window.setTimeout(() => setExiting(true), 260);
      window.setTimeout(() => {
        document.documentElement.dataset.gfReady = "true";
        document.body.style.overflow = "";
        setVisible(false);
      }, 260 + EXIT_DURATION);
    };

    animationFrame.current = window.requestAnimationFrame(tick);
    return () => {
      if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current);
      window.clearTimeout(skipTimer);
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (firstPath.current === pathname || visible) return;
    firstPath.current = pathname;
    setRouteLoading(true);
    const timer = window.setTimeout(() => setRouteLoading(false), 720);
    return () => window.clearTimeout(timer);
  }, [pathname, visible]);

  function skip() {
    if (!canSkip || exiting) return;
    if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current);
    setProgress(100);
    setExiting(true);
    window.setTimeout(() => {
      document.documentElement.dataset.gfReady = "true";
      document.body.style.overflow = "";
      setVisible(false);
    }, EXIT_DURATION);
  }

  return (
    <>
      <div className={`gf-route-progress ${routeLoading ? "gf-route-progress--active" : ""}`} aria-hidden="true" />
      {visible ? (
        <div className={`gf-preloader fixed inset-0 z-[500] grid place-items-center overflow-hidden bg-[#05040d] px-6 ${exiting ? "gf-preloader--exit" : ""}`} role="status" aria-live="polite" aria-label={`GameForge loading: ${stage.label}`}>
          <div className="gf-preloader-grid absolute inset-0" aria-hidden="true" />
          <div className="gf-preloader-vignette absolute inset-0" aria-hidden="true" />
          <div className="gf-preloader-beam absolute left-1/2 top-0 h-full w-px -translate-x-1/2" aria-hidden="true" />

          <div className="relative z-10 flex w-full max-w-xl flex-col items-center text-center">
            <div className="gf-loader-aura absolute top-0 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" aria-hidden="true" />
            <div className="relative grid h-40 w-40 place-items-center">
              <div className="gf-loader-ring gf-loader-ring--outer absolute inset-0 rounded-full" />
              <div className="gf-loader-ring gf-loader-ring--middle absolute inset-4 rounded-full" />
              <div className="gf-loader-ring gf-loader-ring--inner absolute inset-9 rounded-full" />
              <span className="gf-loader-scan absolute inset-0 rounded-full" />
              <span className="gf-loader-ticks absolute inset-2 rounded-full" />
              <span className="relative z-10 grid h-20 w-20 place-items-center rounded-[24px] border border-white/15 bg-black/60 shadow-[0_0_40px_rgba(139,92,246,.42)]">
                <Image src="/Logo.png" alt="" width={68} height={68} priority className="rounded-[20px]" />
              </span>
            </div>
            <p className="mt-8 text-[11px] font-black uppercase tracking-[0.38em] text-cyan-300">GameForge AI</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Opening GameForge Studio</h1>
            <div className="mt-5 min-h-[58px]">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-violet-200">{stage.label}</p>
              <p className="mt-2 text-sm text-zinc-400">{stage.detail}</p>
            </div>
            <div className="mt-7 w-full max-w-md">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500"><span>Design intelligence</span><span className="text-cyan-200">{progress}%</span></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full border border-white/5 bg-white/[0.07]"><span className="gf-loader-progress block h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400" style={{ width: `${progress}%` }} /></div>
              <div className="mt-3 grid grid-cols-5 gap-2" aria-hidden="true">{stages.map((item) => <span key={item.label} className={`h-1 rounded-full transition duration-500 ${progress >= item.at ? "bg-cyan-300/80" : "bg-white/8"}`} />)}</div>
            </div>
            <div className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_9px_rgba(52,211,153,.8)]" />Connected pre-production systems online</div>
            <button type="button" onClick={skip} disabled={!canSkip || exiting} className={`mt-6 rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition ${canSkip ? "border-white/10 text-zinc-400 hover:border-cyan-300/30 hover:text-white" : "pointer-events-none border-transparent text-transparent"}`}>Skip intro</button>
          </div>
        </div>
      ) : null}
    </>
  );
}
