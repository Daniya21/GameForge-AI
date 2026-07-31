import type { GameBlueprint } from "@/app/types/blueprint";
import SectionCard from "./SectionCard";

type Props = {
  overview: GameBlueprint["overview"];
};

const detailItems = [
  { key: "genre", label: "Genre" },
  { key: "platform", label: "Platform" },
  { key: "artStyle", label: "Art System · Locked" },
  { key: "perspective", label: "Perspective" },
] as const;

export default function OverviewSection({ overview }: Props) {
  return (
    <SectionCard
      eyebrow="01 · Overview"
      title="Game Overview"
      description="The central identity, creative direction, and high-level vision for the game."
    >
      <div className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 via-zinc-950/70 to-cyan-500/5 p-6 sm:p-8">
        <p className="text-xl font-semibold leading-8 text-violet-200 sm:text-2xl">
          {overview.tagline}
        </p>

        <p className="mt-5 max-w-4xl leading-8 text-zinc-300">
          {overview.highConcept}
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {detailItems.map((item) => (
          <article
            key={item.key}
            className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5 transition hover:border-violet-400/30 hover:bg-zinc-950"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              {item.label}
            </p>

            <p className="mt-3 font-semibold leading-6 text-white">
              {overview[item.key]}
            </p>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}