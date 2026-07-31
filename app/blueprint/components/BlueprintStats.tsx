import type { GameBlueprint } from "@/app/types/blueprint";

type Props = {
  blueprint: GameBlueprint;
};

export default function BlueprintStats({ blueprint }: Props) {
  const stats = [
    {
      label: "Genre",
      value: blueprint.overview.genre,
    },
    {
      label: "Game Mode",
      value: blueprint.overview.gameMode,
    },
    {
      label: "Engine",
      value: blueprint.technicalPlan.recommendedEngine,
    },
    {
      label: "Art System · Locked",
      value: blueprint.overview.artStyle,
    },
    {
      label: "Characters",
      value: blueprint.characters.length,
    },
    {
      label: "Enemies",
      value: blueprint.enemies.length,
    },
    {
      label: "Quests",
      value: blueprint.quests.length,
    },
    {
      label: "Locations",
      value: blueprint.world.locations.length,
    },
  ];

  return (
    <section>
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
          Blueprint Analytics
        </p>

        <h2 className="mt-2 text-2xl font-bold text-white">
          Game Snapshot
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-violet-400/30 hover:bg-white/[0.06]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              {stat.label}
            </p>

            <p className="mt-3 break-words text-xl font-bold text-white">
              {stat.value}
            </p>

            <div className="mt-5 h-1 w-10 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-300 group-hover:w-20" />
          </article>
        ))}
      </div>
    </section>
  );
}