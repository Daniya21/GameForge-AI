import type { GameBlueprint } from "@/app/types/blueprint";
import SectionCard from "./SectionCard";

type Props = {
  quests: GameBlueprint["quests"];
};

export default function QuestsSection({ quests }: Props) {
  return (
    <SectionCard
      eyebrow="07 · Quests"
      title="Quest Journal"
      description="Main quests, side quests, objectives, rewards, and failure conditions."
    >
      <div className="space-y-6">
        {quests.map((quest) => (
          <article
            key={quest.title}
            className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6 transition hover:border-violet-400/40"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-widest text-violet-300">
                  {quest.type}
                </p>

                <h3 className="mt-2 text-2xl font-bold text-white">
                  {quest.title}
                </h3>
              </div>
            </div>

            <p className="mt-5 leading-8 text-zinc-300">
              {quest.description}
            </p>

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <div>
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-widest text-cyan-300">
                  Objectives
                </h4>

                <div className="space-y-2">
                  {quest.objectives.map((objective) => (
                    <div
                      key={objective}
                      className="rounded-xl bg-white/5 p-3 text-zinc-300"
                    >
                      ✓ {objective}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-widest text-amber-300">
                  Rewards
                </h4>

                <div className="flex flex-wrap gap-2">
                  {quest.rewards.map((reward) => (
                    <span
                      key={reward}
                      className="rounded-full bg-amber-500/10 px-3 py-2 text-sm text-amber-300"
                    >
                      {reward}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-widest text-red-300">
                  Failure Condition
                </h4>

                <div className="rounded-xl bg-red-500/10 p-4 text-zinc-300">
                  {quest.failureCondition}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}