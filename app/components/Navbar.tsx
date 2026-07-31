"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import GameProjectBadge from "./game-project/GameProjectBadge";

const links = [
  { href: "/", label: "Home" },
  { href: "/projects", label: "Projects" },
  { href: "/design-studio", label: "Design Studio" },
  { href: "/production-intelligence", label: "Production" },
  { href: "/team-workspace", label: "Team Handoff" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-[200] border-b transition-all duration-300 ${
        scrolled
          ? "border-white/10 bg-[#070510]/92 shadow-[0_14px_50px_rgba(0,0,0,.46)] backdrop-blur-2xl"
          : "border-white/[0.07] bg-[#070510]/76 backdrop-blur-xl"
      }`}
    >
      <nav className="mx-auto grid h-[76px] max-w-[1780px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group inline-flex min-w-0 items-center gap-3" aria-label="GameForge AI home">
          <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-violet-300/20 bg-white/[0.04] shadow-[0_0_26px_rgba(139,92,246,.3)] transition duration-300 group-hover:-translate-y-0.5 group-hover:border-cyan-300/35">
            <Image src="/Logo.png" alt="GameForge AI logo" width={38} height={38} priority className="rounded-xl object-cover" />
          </span>
          <span className="hidden whitespace-nowrap text-xl font-black tracking-tight sm:inline">
            <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">GameForge</span>
            <span className="ml-1 text-white">AI</span>
          </span>
        </Link>

        <div className="hidden min-w-0 justify-center min-[1260px]:flex">
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.035] p-1.5">
            {links.map((link) => {
              const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-bold transition-all ${
                    active ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {link.label}
                  {active ? <span className="absolute inset-x-4 -bottom-0.5 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent" /> : null}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2.5">
          <div className="hidden min-[1530px]:block">
            <GameProjectBadge compact />
          </div>
          <Link
            href="/projects"
            className="group hidden h-11 items-center whitespace-nowrap rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 px-5 text-sm font-black text-white shadow-[0_10px_30px_rgba(139,92,246,.25)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(139,92,246,.38)] sm:inline-flex"
          >
            New Project
            <span className="ml-2 transition-transform group-hover:translate-x-1">→</span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:border-violet-300/30 hover:bg-white/10 min-[1260px]:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={open}
          >
            <span className="text-xl leading-none">{open ? "×" : "☰"}</span>
          </button>
        </div>
      </nav>

      <div className={`overflow-hidden transition-[max-height,opacity] duration-300 min-[1260px]:hidden ${open ? "max-h-[760px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="border-t border-white/10 bg-[#070510]/98 px-5 py-4 backdrop-blur-2xl">
          <div className="mx-auto grid max-w-7xl gap-2">
            {links.map((link) => {
              const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link key={link.href} href={link.href} className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${active ? "bg-white/10 text-white" : "text-zinc-300 hover:bg-white/[0.07]"}`}>
                  {link.label}
                </Link>
              );
            })}
            <div className="mt-2"><GameProjectBadge /></div>
            <Link href="/design-studio" className="mt-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.08] px-4 py-3 text-center text-sm font-black text-cyan-100">
              Open Design Studio
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
