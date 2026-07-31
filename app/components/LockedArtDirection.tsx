import {
  LOCKED_ART_DIRECTION,
  LOCKED_ART_STYLE,
} from "@/lib/art-direction/stylized-3d";

type Props = {
  compact?: boolean;
  className?: string;
};

export default function LockedArtDirection({ compact = false, className = "" }: Props) {
  return (
    <div
      className={`rounded-2xl border border-fuchsia-300/20 bg-gradient-to-br from-fuchsia-400/[0.09] via-violet-400/[0.06] to-cyan-300/[0.07] ${compact ? "p-4" : "p-5"} ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-200">GameForge art system</p>
          <p className={`${compact ? "mt-1 text-base" : "mt-2 text-lg"} font-black text-white`}>{LOCKED_ART_STYLE}</p>
        </div>
        <span className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-200">
          Locked
        </span>
      </div>
      {!compact && <p className="mt-3 text-sm leading-6 text-zinc-400">{LOCKED_ART_DIRECTION}. Every character, world, image, 3D model, blueprint, GDD and playable build uses this same visual language.</p>}
    </div>
  );
}
