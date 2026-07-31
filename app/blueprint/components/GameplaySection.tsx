import type { GameBlueprint } from "@/app/types/blueprint";
import SectionCard from "./SectionCard";

type Props = {
  gameplay: GameBlueprint["gameplay"];
};

export default function GameplaySection({ gameplay }: Props) {
  return (
    <SectionCard
      eyebrow="02 · Gameplay"
      title="Gameplay Design"
      description="The core player experience, gameplay loop, mechanics, and progression systems."
    >
      <div className="space-y-8">
        {/* Player Fantasy */}
        <div className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 via-zinc-950/70 to-cyan-500/5 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-300">
            Player Fantasy
          </p>

          <p className="mt-4 text-lg leading-8 text-zinc-300">
            {gameplay.playerFantasy}
          </p>
        </div>

        {/* Core Gameplay Loop */}
        <div>
          <h3 className="mb-5 text-xl font-bold text-white">
            Core Gameplay Loop
          </h3>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {gameplay.coreLoop.map((step, index) => (
              <div
                key={step}
                className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5 transition hover:border-violet-400/40 hover:-translate-y-1"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 font-bold text-violet-300">
                  {index + 1}
                </div>

                <p className="mt-4 leading-7 text-zinc-300">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Main Mechanics */}
        <div>
          <h3 className="mb-5 text-xl font-bold text-white">
            Core Mechanics
          </h3>

          <div className="grid gap-4 md:grid-cols-2">
            {gameplay.mainMechanics.map((mechanic) => (
              <article
                key={mechanic}
                className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5 transition hover:border-cyan-400/30"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-300">
                    ⚙️
                  </div>

                  <p className="leading-7 text-zinc-300">
                    {mechanic}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Progression */}
        <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-6">
          <h3 className="text-xl font-bold text-white">
            Progression System
          </h3>

          <p className="mt-4 leading-8 text-zinc-300">
            {gameplay.progression}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}