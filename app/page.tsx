import Link from "next/link";
import {
  BookOpen,
  Bot,
  FileText,
  Globe2,
  MessageSquare,
  Palette,
  Swords,
  Users,
} from "lucide-react";

import InteractiveForgeHero from "./components/home/InteractiveForgeHero";

const floatingTools = [
  {
    label: "Story",
    icon: BookOpen,
    top: "14%",
    left: "4%",
    color: "text-violet-200",
    iconBackground: "bg-violet-400/10",
    border: "border-violet-300/25",
    glow: "shadow-[0_0_28px_rgba(168,85,247,.34)]",
  },
  {
    label: "Characters",
    icon: Users,
    top: "39%",
    left: "6%",
    color: "text-blue-200",
    iconBackground: "bg-blue-400/10",
    border: "border-blue-300/25",
    glow: "shadow-[0_0_28px_rgba(59,130,246,.30)]",
  },
  {
    label: "World",
    icon: Globe2,
    top: "66%",
    left: "5%",
    color: "text-cyan-200",
    iconBackground: "bg-cyan-400/10",
    border: "border-cyan-300/25",
    glow: "shadow-[0_0_28px_rgba(34,211,238,.28)]",
  },
  {
    label: "Quests",
    icon: Swords,
    top: "84%",
    left: "17%",
    color: "text-fuchsia-200",
    iconBackground: "bg-fuchsia-400/10",
    border: "border-fuchsia-300/25",
    glow: "shadow-[0_0_28px_rgba(217,70,239,.30)]",
  },
  {
    label: "Dialogue",
    icon: MessageSquare,
    top: "18%",
    right: "5%",
    color: "text-violet-200",
    iconBackground: "bg-violet-400/10",
    border: "border-violet-300/25",
    glow: "shadow-[0_0_28px_rgba(168,85,247,.32)]",
  },
  {
    label: "Art",
    icon: Palette,
    top: "46%",
    right: "4%",
    color: "text-pink-200",
    iconBackground: "bg-pink-400/10",
    border: "border-pink-300/25",
    glow: "shadow-[0_0_28px_rgba(236,72,153,.28)]",
  },
  {
    label: "AI Producer",
    icon: Bot,
    top: "71%",
    right: "5%",
    color: "text-cyan-200",
    iconBackground: "bg-cyan-400/10",
    border: "border-cyan-300/25",
    glow: "shadow-[0_0_28px_rgba(34,211,238,.30)]",
  },
  {
    label: "Final GDD",
    icon: FileText,
    top: "86%",
    right: "16%",
    color: "text-indigo-200",
    iconBackground: "bg-indigo-400/10",
    border: "border-indigo-300/25",
    glow: "shadow-[0_0_28px_rgba(99,102,241,.30)]",
  },
];

const workflow = [
  [
    "01",
    "Create a project",
    "Start a separate workspace for every game so previous work is never overwritten.",
  ],
  [
    "02",
    "Design",
    "Complete story, characters, world, quests, dialogue, and the AI Producer review.",
  ],
  [
    "03",
    "Plan production",
    "Translate the approved design into scope, team roles, milestones, risks, and delivery priorities.",
  ],
  [
    "04",
    "Hand off",
    "Prepare role-based tasks and implementation notes for the production team.",
  ],
  [
    "05",
    "Export",
    "Automatically assemble the finished project into a professional final GDD.",
  ],
];

const systems = [
  [
    "Project Library",
    "Create, reopen, duplicate, and manage independent game projects without overwriting existing work.",
    "/projects",
  ],
  [
    "Design Studio",
    "Six focused tools for story, characters, world, quests, dialogue, and production review.",
    "/design-studio",
  ],
  [
    "Production",
    "Estimate team shape, development phases, project complexity, major risks, and minimum viable delivery.",
    "/production-intelligence",
  ],
  [
    "Team Handoff",
    "Turn approved design decisions into role-based tasks, milestones, and a clear implementation brief.",
    "/team-workspace",
  ],
  [
    "Final GDD",
    "Automatically assemble the completed project and export the production document.",
    "/gdd-export",
  ],
];

export default function Home() {
  return (
    <main className="min-h-screen text-white">
      <style>{`
        @keyframes gameforgeFloat {
          0%,
          100% {
            transform: translateY(0) rotate(0deg);
          }

          50% {
            transform: translateY(-12px) rotate(1deg);
          }
        }

        @keyframes gameforgeIconGlow {
          0%,
          100% {
            opacity: 0.82;
          }

          50% {
            opacity: 1;
          }
        }
      `}</style>

      {/* Hero and floating game-design tool cards */}
      <div className="relative overflow-hidden">
        <InteractiveForgeHero />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 hidden xl:block"
        >
          {floatingTools.map(
            (
              {
                label,
                icon: Icon,
                top,
                left,
                right,
                color,
                iconBackground,
                border,
                glow,
              },
              index,
            ) => (
              <div
                key={label}
                className={`absolute flex min-w-[118px] items-center gap-3 rounded-2xl border bg-[#090713]/72 px-3 py-3 backdrop-blur-xl ${border} ${glow}`}
                style={{
                  top,
                  left,
                  right,
                  animation: `gameforgeFloat ${
                    5.4 + index * 0.22
                  }s ease-in-out infinite`,
                  animationDelay: `${index * 180}ms`,
                }}
              >
                <div
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 ${iconBackground}`}
                  style={{
                    animation:
                      "gameforgeIconGlow 2.8s ease-in-out infinite",
                    animationDelay: `${index * 140}ms`,
                  }}
                >
                  <Icon
                    aria-hidden="true"
                    className={`h-5 w-5 ${color}`}
                    strokeWidth={1.8}
                  />
                </div>

                <span className="whitespace-nowrap text-[10px] font-black uppercase tracking-[0.13em] text-white/85">
                  {label}
                </span>
              </div>
            ),
          )}
        </div>
      </div>

      <section
        id="workflow"
        className="scroll-mt-24 border-b border-white/[0.07] bg-[#07050f]/90 py-24"
      >
        <div className="mx-auto w-full max-w-[1480px] px-5 sm:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
              GameForge solution
            </p>

            <h2 className="mt-4 text-4xl font-black tracking-[-.03em] sm:text-5xl">
              A game pre-production studio for a development-ready plan.
            </h2>

            <p className="mt-5 text-lg leading-8 text-zinc-400">
              GameForge focuses on the difficult work that happens before
              production: structuring ideas, keeping systems consistent,
              testing changes, and communicating a clear plan.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {workflow.map(([number, title, description]) => (
              <article
                key={number}
                className="gf-interactive-card rounded-[26px] border border-white/[0.09] bg-white/[0.035] p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black tracking-[0.2em] text-violet-300">
                    {number}
                  </span>

                  <span className="h-px w-16 bg-gradient-to-r from-violet-400/70 to-transparent" />
                </div>

                <h3 className="mt-8 text-2xl font-black">{title}</h3>

                <p className="mt-3 leading-7 text-zinc-400">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-black/20 py-24">
        <div className="mx-auto w-full max-w-[1480px] px-5 sm:px-8">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
                Design intelligence platform
              </p>

              <h2 className="mt-4 text-4xl font-black tracking-[-.03em] sm:text-5xl">
                A focused production workflow without repeated pages.
              </h2>

              <p className="mt-5 text-lg leading-8 text-zinc-400">
                Every tool has one clear purpose and contributes to the active
                project. The final GDD is generated only after the design and
                production work are ready.
              </p>
            </div>

            <Link
              href="/design-studio"
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-300/[0.08] px-6 font-black text-violet-100 transition hover:-translate-y-1 hover:border-violet-300/40 hover:bg-violet-300/[0.12]"
            >
              Explore all agents →
            </Link>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {systems.map(([title, description, href], index) => (
              <Link
                key={title}
                href={href}
                className="group rounded-[28px] border border-white/[0.09] bg-gradient-to-br from-white/[0.055] to-white/[0.018] p-7 transition duration-300 hover:-translate-y-1.5 hover:border-cyan-300/25 hover:shadow-[0_26px_70px_rgba(0,0,0,.34)]"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-black/25 text-lg font-black text-cyan-200">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <span className="text-zinc-600 transition group-hover:translate-x-1 group-hover:text-cyan-200">
                    →
                  </span>
                </div>

                <h3 className="mt-8 text-2xl font-black">{title}</h3>

                <p className="mt-3 leading-7 text-zinc-400">
                  {description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.07] bg-[radial-gradient(circle_at_50%_100%,rgba(124,58,237,.16),transparent_48%)] py-24 text-center">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-300">
            Honest product positioning
          </p>

          <h2 className="mt-4 text-4xl font-black tracking-[-.03em] sm:text-5xl">
            GameForge prepares the project. Development teams build the game.
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-zinc-400">
            The platform does not replace Unity, Unreal Engine, Godot, artists,
            programmers, or producers. It gives them a connected, validated,
            and development-ready foundation.
          </p>

          <Link
            href="/design-studio"
            className="mt-9 inline-flex h-14 items-center justify-center rounded-2xl bg-white px-8 font-black text-black transition hover:-translate-y-1 hover:bg-cyan-100"
          >
            Start a Game Project →
          </Link>
        </div>
      </section>
    </main>
  );
}