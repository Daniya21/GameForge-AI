import type { GameBlueprint } from "@/app/types/blueprint";
import SectionCard from "./SectionCard";

type Props = {
  progression: GameBlueprint["progression"];
};

export default function ProgressionSection({
  progression,
}: Props) {
  return (
    <SectionCard
      eyebrow="08 · Progression"
      title="Player Progression"
      description="How the player grows through leveling, skills, equipment, upgrades, and currencies."
    >
      <div className="space-y-8">
        <div className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 via-zinc-950/70 to-cyan-500/5 p-6">
          <h3 className="text-xl font-bold text-white">
            Leveling System
          </h3>

          <p className="mt-4 leading-8 text-zinc-300">
            {progression.levelingSystem}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-4 text-lg font-bold">
              Skills
            </h3>

            <div className="space-y-3">
              {progression.skills.map((skill) => (
                <div
                  key={skill}
                  className="rounded-xl border border-white/10 bg-zinc-950/60 p-4"
                >
                  {skill}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-bold">
              Unlockable Abilities
            </h3>

            <div className="space-y-3">
              {progression.unlockableAbilities.map((ability) => (
                <div
                  key={ability}
                  className="rounded-xl border border-white/10 bg-zinc-950/60 p-4"
                >
                  {ability}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-4 text-lg font-bold">
              Equipment
            </h3>

            <div className="flex flex-wrap gap-2">
              {progression.equipment.map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-cyan-500/10 px-3 py-2 text-cyan-300"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-bold">
              Currencies
            </h3>

            <div className="flex flex-wrap gap-2">
              {progression.currencies.map((currency) => (
                <span
                  key={currency}
                  className="rounded-full bg-amber-500/10 px-3 py-2 text-amber-300"
                >
                  {currency}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-6">
          <h3 className="text-xl font-bold">
            Upgrade System
          </h3>

          <p className="mt-4 leading-8 text-zinc-300">
            {progression.upgradeSystem}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}