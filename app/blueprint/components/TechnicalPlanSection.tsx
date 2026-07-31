import type { GameBlueprint } from "@/app/types/blueprint";
import SectionCard from "./SectionCard";

type Props = {
  technicalPlan: GameBlueprint["technicalPlan"];
};

export default function TechnicalPlanSection({
  technicalPlan,
}: Props) {
  return (
    <SectionCard
      eyebrow="11 · Technical"
      title="Technical Development Plan"
      description="The recommended engine, required systems, AI needs, performance targets, and development order."
    >
      <div className="space-y-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 via-zinc-950/70 to-cyan-500/5 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
              Recommended Engine
            </p>

            <h3 className="mt-3 text-2xl font-bold text-white">
              {technicalPlan.recommendedEngine}
            </h3>
          </article>

          <article className="rounded-2xl border border-white/10 bg-zinc-950/60 p-6">
            <h3 className="text-lg font-bold text-white">
              Camera System
            </h3>

            <p className="mt-4 leading-8 text-zinc-300">
              {technicalPlan.cameraSystem}
            </p>
          </article>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-zinc-950/60 p-6">
            <h3 className="text-lg font-bold text-white">
              Input System
            </h3>

            <p className="mt-4 leading-8 text-zinc-300">
              {technicalPlan.inputSystem}
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-zinc-950/60 p-6">
            <h3 className="text-lg font-bold text-white">
              Save System
            </h3>

            <p className="mt-4 leading-8 text-zinc-300">
              {technicalPlan.saveSystem}
            </p>
          </article>
        </div>

        <div>
          <h3 className="mb-5 text-xl font-bold text-white">
            Required Systems
          </h3>

          <div className="grid gap-4 md:grid-cols-2">
            {technicalPlan.requiredSystems.map((system) => (
              <article
                key={system}
                className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5 transition hover:border-violet-400/30"
              >
                <p className="leading-7 text-zinc-300">
                  {system}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
            <h3 className="text-xl font-bold text-red-300">
              Enemy AI Requirements
            </h3>

            <div className="mt-5 space-y-3">
              {technicalPlan.enemyAiRequirements.map((requirement) => (
                <div
                  key={requirement}
                  className="rounded-xl bg-black/20 p-4 text-zinc-300"
                >
                  {requirement}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-6">
            <h3 className="text-xl font-bold text-cyan-300">
              Performance Targets
            </h3>

            <div className="mt-5 space-y-3">
              {technicalPlan.performanceTargets.map((target) => (
                <div
                  key={target}
                  className="rounded-xl bg-black/20 p-4 text-zinc-300"
                >
                  {target}
                </div>
              ))}
            </div>
          </article>
        </div>

        <div>
          <h3 className="mb-5 text-xl font-bold text-white">
            Recommended Development Order
          </h3>

          <div className="space-y-4">
            {technicalPlan.recommendedDevelopmentOrder.map(
              (step, index) => (
                <article
                  key={step}
                  className="flex gap-4 rounded-2xl border border-white/10 bg-zinc-950/60 p-5"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 font-bold text-violet-300">
                    {index + 1}
                  </div>

                  <p className="leading-7 text-zinc-300">
                    {step}
                  </p>
                </article>
              )
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}