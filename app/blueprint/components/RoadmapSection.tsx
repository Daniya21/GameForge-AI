import type { GameBlueprint } from "@/app/types/blueprint";
import SectionCard from "./SectionCard";

type Props = {
  roadmap: GameBlueprint["roadmap"];
};

const phases = [
  {
    title: "Prototype",
    color: "text-cyan-300",
    bg: "bg-cyan-500/5 border-cyan-500/20",
    key: "prototype",
  },
  {
    title: "Vertical Slice",
    color: "text-violet-300",
    bg: "bg-violet-500/5 border-violet-500/20",
    key: "verticalSlice",
  },
  {
    title: "Alpha",
    color: "text-green-300",
    bg: "bg-green-500/5 border-green-500/20",
    key: "alpha",
  },
  {
    title: "Beta",
    color: "text-amber-300",
    bg: "bg-amber-500/5 border-amber-500/20",
    key: "beta",
  },
  {
    title: "Final Polish",
    color: "text-fuchsia-300",
    bg: "bg-fuchsia-500/5 border-fuchsia-500/20",
    key: "finalPolish",
  },
] as const;

export default function RoadmapSection({ roadmap }: Props) {
  return (
    <SectionCard
      eyebrow="12 · Roadmap"
      title="Development Roadmap"
      description="A milestone-based production plan from prototype to release."
    >
      <div className="space-y-8">
        {phases.map((phase) => (
          <article
            key={phase.key}
            className={`rounded-3xl border p-6 ${phase.bg}`}
          >
            <h3 className={`text-2xl font-bold ${phase.color}`}>
              {phase.title}
            </h3>

            <div className="mt-5 space-y-3">
              {roadmap[phase.key].map((task) => (
                <div
                  key={task}
                  className="rounded-xl bg-black/20 p-4 text-zinc-300"
                >
                  ✓ {task}
                </div>
              ))}
            </div>
          </article>
        ))}

        <article className="rounded-3xl border border-red-500/20 bg-red-500/5 p-6">
          <h3 className="text-2xl font-bold text-red-300">
            Major Risks
          </h3>

          <div className="mt-5 space-y-3">
            {roadmap.majorRisks.map((risk) => (
              <div
                key={risk}
                className="rounded-xl bg-black/20 p-4 text-zinc-300"
              >
                ⚠️ {risk}
              </div>
            ))}
          </div>
        </article>
      </div>
    </SectionCard>
  );
}