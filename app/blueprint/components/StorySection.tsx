import type { GameBlueprint } from "@/app/types/blueprint";
import SectionCard from "./SectionCard";

type Props = {
  story: GameBlueprint["story"];
};

export default function StorySection({ story }: Props) {
  return (
    <SectionCard
      eyebrow="03 · Narrative"
      title="Story & Narrative"
      description="The game's narrative foundation, player journey, major plot beats, and meaningful choices."
    >
      <div className="space-y-8">
        {/* Premise */}
        <div className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 via-zinc-950/70 to-cyan-500/5 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-300">
            Story Premise
          </p>

          <p className="mt-4 text-lg leading-8 text-zinc-300">
            {story.premise}
          </p>
        </div>

        {/* Player + Conflict */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-6">
            <h3 className="text-lg font-bold text-white">
              Player Role
            </h3>

            <p className="mt-4 leading-8 text-zinc-300">
              {story.playerRole}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-6">
            <h3 className="text-lg font-bold text-white">
              Main Conflict
            </h3>

            <p className="mt-4 leading-8 text-zinc-300">
              {story.mainConflict}
            </p>
          </div>
        </div>

        {/* Story Structure */}
        <div>
          <h3 className="mb-5 text-xl font-bold text-white">
            Story Structure
          </h3>

          <div className="grid gap-5 lg:grid-cols-3">
            {[
              {
                title: "Beginning",
                emoji: "🌅",
                text: story.beginning,
              },
              {
                title: "Middle",
                emoji: "⚔️",
                text: story.middle,
              },
              {
                title: "Ending",
                emoji: "👑",
                text: story.ending,
              },
            ].map((part) => (
              <article
                key={part.title}
                className="rounded-2xl border border-white/10 bg-zinc-950/60 p-6 transition hover:border-violet-400/40 hover:-translate-y-1"
              >
                <div className="text-3xl">
                  {part.emoji}
                </div>

                <h4 className="mt-4 text-lg font-bold text-white">
                  {part.title}
                </h4>

                <p className="mt-3 leading-7 text-zinc-300">
                  {part.text}
                </p>
              </article>
            ))}
          </div>
        </div>

        {/* Plot Twist */}
        <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-6">
          <h3 className="text-lg font-bold text-fuchsia-300">
            Major Plot Twist
          </h3>

          <p className="mt-4 leading-8 text-zinc-300">
            {story.mainTwist}
          </p>
        </div>

        {/* Choices */}
        <div>
          <h3 className="mb-5 text-xl font-bold text-white">
            Important Player Choices
          </h3>

          <div className="grid gap-4">
            {story.importantChoices.map((choice, index) => (
              <article
                key={choice}
                className="flex gap-5 rounded-2xl border border-white/10 bg-zinc-950/60 p-5 transition hover:border-cyan-400/30"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 font-bold text-cyan-300">
                  {index + 1}
                </div>

                <p className="leading-7 text-zinc-300">
                  {choice}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}