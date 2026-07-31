import type { GameBlueprint } from "@/app/types/blueprint";
import SectionCard from "./SectionCard";

type Props = {
  world: GameBlueprint["world"];
};

export default function WorldSection({ world }: Props) {
  return (
    <SectionCard
      eyebrow="04 · World"
      title={world.name}
      description="The setting, lore, factions, locations, hazards, and hidden mysteries that shape the player's adventure."
    >
      <div className="space-y-8">
        {/* World Summary */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 via-zinc-950/70 to-cyan-500/5 p-6">
            <h3 className="text-lg font-bold text-white">Setting</h3>

            <p className="mt-4 leading-8 text-zinc-300">
              {world.setting}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-6">
            <h3 className="text-lg font-bold text-white">Atmosphere</h3>

            <p className="mt-4 leading-8 text-zinc-300">
              {world.atmosphere}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-6">
            <h3 className="text-lg font-bold text-white">History</h3>

            <p className="mt-4 leading-8 text-zinc-300">
              {world.history}
            </p>
          </div>
        </div>

        {/* World Rules */}
        <div>
          <h3 className="mb-5 text-xl font-bold text-white">
            World Rules
          </h3>

          <div className="grid gap-4 md:grid-cols-2">
            {world.worldRules.map((rule) => (
              <article
                key={rule}
                className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5 transition hover:border-violet-400/30"
              >
                <p className="leading-7 text-zinc-300">
                  {rule}
                </p>
              </article>
            ))}
          </div>
        </div>

        {/* Locations */}
        <div>
          <h3 className="mb-5 text-xl font-bold text-white">
            Important Locations
          </h3>

          <div className="grid gap-5 lg:grid-cols-2">
            {world.locations.map((location) => (
              <article
                key={location.name}
                className="rounded-2xl border border-white/10 bg-zinc-950/60 p-6 transition hover:-translate-y-1 hover:border-cyan-400/40"
              >
                <h4 className="text-xl font-bold text-white">
                  📍 {location.name}
                </h4>

                <p className="mt-4 leading-7 text-zinc-300">
                  {location.description}
                </p>

                <div className="mt-5 rounded-xl bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-widest text-violet-300">
                    Purpose
                  </p>

                  <p className="mt-2 text-zinc-300">
                    {location.purpose}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Factions */}
        <div>
          <h3 className="mb-5 text-xl font-bold text-white">
            Major Factions
          </h3>

          <div className="grid gap-5 lg:grid-cols-2">
            {world.factions.map((faction) => (
              <article
                key={faction.name}
                className="rounded-2xl border border-white/10 bg-zinc-950/60 p-6 transition hover:border-fuchsia-400/40"
              >
                <h4 className="text-xl font-bold text-white">
                  🛡️ {faction.name}
                </h4>

                <p className="mt-4 leading-7 text-zinc-300">
                  {faction.description}
                </p>

                <div className="mt-6 space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-violet-300">
                      Goal
                    </p>

                    <p className="text-zinc-300">
                      {faction.goal}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-widest text-violet-300">
                      Relationship to Player
                    </p>

                    <p className="text-zinc-300">
                      {faction.relationshipToPlayer}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Hazards & Secrets */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
            <h3 className="text-xl font-bold text-red-300">
              ⚠️ Hazards
            </h3>

            <div className="mt-5 space-y-3">
              {world.hazards.map((hazard) => (
                <div
                  key={hazard}
                  className="rounded-xl bg-black/20 p-4 text-zinc-300"
                >
                  {hazard}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
            <h3 className="text-xl font-bold text-amber-300">
              🔍 Hidden Secrets
            </h3>

            <div className="mt-5 space-y-3">
              {world.secrets.map((secret) => (
                <div
                  key={secret}
                  className="rounded-xl bg-black/20 p-4 text-zinc-300"
                >
                  {secret}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}