import type { GameBlueprint } from "@/app/types/blueprint";
import SectionCard from "./SectionCard";

type Props = {
  enemies: GameBlueprint["enemies"];
};

export default function EnemiesSection({ enemies }: Props) {
  return (
    <SectionCard
      eyebrow="06 · Enemies"
      title="Enemy Bestiary"
      description="Every enemy, its behavior, combat abilities, weaknesses, and rewards."
    >
      <div className="grid gap-6 xl:grid-cols-2">
        {enemies.map((enemy) => (
          <article
            key={enemy.name}
            className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/60 transition hover:-translate-y-1 hover:border-red-400/40"
          >
            {/* Portrait */}
            <div className="flex h-56 items-center justify-center border-b border-white/10 bg-gradient-to-br from-red-500/10 to-orange-500/10">
              <div className="text-center">
                <div className="text-6xl">👹</div>

                <p className="mt-4 text-sm text-zinc-500">
                  AI Enemy Art Coming Soon
                </p>
              </div>
            </div>

            <div className="p-6">
              <p className="text-sm uppercase tracking-widest text-red-300">
                {enemy.type}
              </p>

              <h3 className="mt-2 text-2xl font-bold">
                {enemy.name}
              </h3>

              <p className="mt-5 leading-7 text-zinc-300">
                {enemy.description}
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-zinc-500">
                    Behavior
                  </p>

                  <p className="mt-1 text-zinc-300">
                    {enemy.behavior}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-widest text-zinc-500">
                    Weakness
                  </p>

                  <p className="mt-1 text-zinc-300">
                    {enemy.weakness}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <p className="mb-3 text-xs uppercase tracking-widest text-zinc-500">
                  Abilities
                </p>

                <div className="flex flex-wrap gap-2">
                  {enemy.abilities.map((ability) => (
                    <span
                      key={ability}
                      className="rounded-full bg-red-500/10 px-3 py-2 text-sm text-red-300"
                    >
                      {ability}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <p className="mb-3 text-xs uppercase tracking-widest text-zinc-500">
                  Rewards
                </p>

                <div className="flex flex-wrap gap-2">
                  {enemy.rewards.map((reward) => (
                    <span
                      key={reward}
                      className="rounded-full bg-amber-500/10 px-3 py-2 text-sm text-amber-300"
                    >
                      {reward}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}