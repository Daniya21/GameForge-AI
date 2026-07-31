import type { GameBlueprint } from "@/app/types/blueprint";
import SectionCard from "./SectionCard";

type Props = {
  artDirection: GameBlueprint["artDirection"];
};

export default function ArtDirectionSection({
  artDirection,
}: Props) {
  return (
    <SectionCard
      eyebrow="09 · Art Direction"
      title="Visual Art Bible"
      description="The visual language, color system, lighting, character design, environments, and interface direction."
    >
      <div className="space-y-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 via-zinc-950/70 to-cyan-500/5 p-6">
            <h3 className="text-xl font-bold text-white">
              Visual Style
            </h3>

            <p className="mt-4 leading-8 text-zinc-300">
              {artDirection.visualStyle}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-6">
            <h3 className="text-xl font-bold text-white">
              Lighting Style
            </h3>

            <p className="mt-4 leading-8 text-zinc-300">
              {artDirection.lightingStyle}
            </p>
          </div>
        </div>

        <div>
          <h3 className="mb-5 text-xl font-bold text-white">
            Color Palette
          </h3>

          <div className="flex flex-wrap gap-3">
            {artDirection.colorPalette.map((color) => (
              <div
                key={color}
                className="rounded-full border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-300"
              >
                {color}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-zinc-950/60 p-6">
            <h3 className="text-lg font-bold text-white">
              Character Style
            </h3>

            <p className="mt-4 leading-8 text-zinc-300">
              {artDirection.characterStyle}
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-zinc-950/60 p-6">
            <h3 className="text-lg font-bold text-white">
              Environment Style
            </h3>

            <p className="mt-4 leading-8 text-zinc-300">
              {artDirection.environmentStyle}
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-zinc-950/60 p-6">
            <h3 className="text-lg font-bold text-white">
              Interface Style
            </h3>

            <p className="mt-4 leading-8 text-zinc-300">
              {artDirection.interfaceStyle}
            </p>
          </article>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Cover Art Prompt
            </p>

            <p className="mt-4 leading-8 text-zinc-300">
              {artDirection.coverArtPrompt}
            </p>
          </article>

          <article className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-300">
              Logo Prompt
            </p>

            <p className="mt-4 leading-8 text-zinc-300">
              {artDirection.logoPrompt}
            </p>
          </article>
        </div>
      </div>
    </SectionCard>
  );
}
