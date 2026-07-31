import type { GameBlueprint } from "@/app/types/blueprint";
import SectionCard from "./SectionCard";

type Props = {
  audioDirection: GameBlueprint["audioDirection"];
};

export default function AudioDirectionSection({
  audioDirection,
}: Props) {
  return (
    <SectionCard
      eyebrow="10 · Audio"
      title="Audio Direction"
      description="Music, ambience, voice direction, combat audio, and environmental sound design."
    >
      <div className="space-y-8">
        <div className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 via-zinc-950/70 to-cyan-500/5 p-6">
          <h3 className="text-xl font-bold">
            Music Style
          </h3>

          <p className="mt-4 leading-8 text-zinc-300">
            {audioDirection.musicStyle}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-6">
          <h3 className="text-xl font-bold">
            Character Voice Direction
          </h3>

          <p className="mt-4 leading-8 text-zinc-300">
            {audioDirection.characterVoiceDirection}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div>
            <h3 className="mb-4 font-bold">
              Ambience
            </h3>

            <div className="space-y-2">
              {audioDirection.ambience.map((sound) => (
                <div
                  key={sound}
                  className="rounded-xl bg-zinc-950/60 p-3"
                >
                  {sound}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-4 font-bold">
              Combat Sounds
            </h3>

            <div className="space-y-2">
              {audioDirection.combatSounds.map((sound) => (
                <div
                  key={sound}
                  className="rounded-xl bg-zinc-950/60 p-3"
                >
                  {sound}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-4 font-bold">
              Environment Sounds
            </h3>

            <div className="space-y-2">
              {audioDirection.environmentSounds.map((sound) => (
                <div
                  key={sound}
                  className="rounded-xl bg-zinc-950/60 p-3"
                >
                  {sound}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6">
            <h3 className="font-bold text-green-300">
              Victory Sound
            </h3>

            <p className="mt-4 text-zinc-300">
              {audioDirection.victorySound}
            </p>
          </article>

          <article className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
            <h3 className="font-bold text-red-300">
              Failure Sound
            </h3>

            <p className="mt-4 text-zinc-300">
              {audioDirection.failureSound}
            </p>
          </article>
        </div>
      </div>
    </SectionCard>
  );
}