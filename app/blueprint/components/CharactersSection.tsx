import type { GameBlueprint } from "@/app/types/blueprint";
import SectionCard from "./SectionCard";

type Props = {
  characters: GameBlueprint["characters"];
};

export default function CharactersSection({
  characters,
}: Props) {
  return (
    <SectionCard
      eyebrow="05 · Characters"
      title="Main Characters"
      description="The heroes, companions, allies, and important NPCs that bring the world to life."
    >
      <div className="grid gap-6 xl:grid-cols-2">
        {characters.map((character) => (
          <article
            key={character.name}
            className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/60 transition hover:-translate-y-1 hover:border-violet-400/40"
          >
            {/* Portrait Placeholder */}
            <div className="flex h-56 items-center justify-center border-b border-white/10 bg-gradient-to-br from-violet-500/10 to-cyan-500/10">
              <div className="text-center">
                <div className="text-6xl">👤</div>

                <p className="mt-4 text-sm text-zinc-500">
                  AI Portrait Coming Soon
                </p>
              </div>
            </div>

            <div className="p-6">
              <p className="text-sm uppercase tracking-widest text-violet-300">
                {character.role}
              </p>

              <h3 className="mt-2 text-2xl font-bold">
                {character.name}
              </h3>

              <p className="mt-5 leading-7 text-zinc-300">
                {character.backstory}
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-zinc-500">
                    Personality
                  </p>

                  <p className="mt-1 text-zinc-300">
                    {character.personality}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-widest text-zinc-500">
                    Motivation
                  </p>

                  <p className="mt-1 text-zinc-300">
                    {character.motivation}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-widest text-zinc-500">
                    Weapon
                  </p>

                  <p className="mt-1 text-zinc-300">
                    {character.weapon}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <p className="mb-3 text-xs uppercase tracking-widest text-zinc-500">
                  Abilities
                </p>

                <div className="flex flex-wrap gap-2">
                  {character.abilities.map((ability) => (
                    <span
                      key={ability}
                      className="rounded-full bg-violet-500/10 px-3 py-2 text-sm text-violet-300"
                    >
                      {ability}
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