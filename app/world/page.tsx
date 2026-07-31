"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import ModelPreview3D from "../components/game/ModelPreview3D";
import { generateAutomaticModel } from "@/lib/game-assets/automatic-3d";
import type { WorldLayout } from "../types/game";
import { saveDesignStudioSection } from "@/lib/game-project/client";

type FormState = {
  concept: string;
  scale: string;
  focus: string;
  artStyle: string;
  atmosphere: string;
  visualNotes: string;
};

type ResultSection = {
  title: string;
  content: string;
};

type WorldResult = {
  worldName: string;
  worldTagline: string;
  summary: string;
  sections: ResultSection[];
  worldImagePrompt: string;
  worldImageDataUrl: string | null;
  worldImageError: string | null;
  worldImageMeta?: { width: number; height: number; model: string };
  generationWarning?: string | null;
  layout: WorldLayout;
  worldModelUrl?: string;
  worldModelTaskId?: string;
  worldModelStatus?: "ready" | "unavailable" | "failed";
  worldModelMessage?: string;
};

const INITIAL_FORM: FormState = {
  concept: "",
  scale: "One region",
  focus: "Open-World RPG",
  artStyle: "Stylized 3D",
  atmosphere: "Mysterious and awe-inspiring",
  visualNotes: "",
};

const EXAMPLES = [
  "A drowned empire where giant cathedrals float above bioluminescent storm seas and every island is powered by captive weather spirits.",
  "A vertical desert world built inside the ribs of an ancient sleeping titan, with caravans traveling by gliders between cliff-cities.",
  "A frozen machine-forest planet where roots of metal trees store lost memories and entire factions fight to control them.",
];

const LOADING_STAGES = [
  "Understanding the world concept",
  "Designing geography, factions, and landmarks",
  "Building traversal, conflict, and gameplay hooks",
  "Rendering the stylized 3D world reference",
  "Building the signature world landmark GLB",
];

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: keyof FormState;
  label: string;
  value: string;
  options: string[];
  onChange: (name: keyof FormState, value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-bold text-zinc-200">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(id, event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-zinc-950 p-4 text-white outline-none transition focus:border-cyan-400/60 focus:shadow-[0_0_24px_rgba(34,211,238,.12)]"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function WorldPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [result, setResult] = useState<WorldResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [generationError, setGenerationError] = useState("");
  const [copied, setCopied] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [modelMessage, setModelMessage] = useState("");

  useEffect(() => {
    if (!loading) return;

    const timer = window.setInterval(() => {
      setLoadingStage((current) =>
        current < LOADING_STAGES.length - 1 ? current + 1 : current,
      );
    }, 2300);

    return () => window.clearInterval(timer);
  }, [loading]);

  const blueprintText = useMemo(() => {
    if (!result) return "";

    return [
      `${result.worldName} — ${result.worldTagline}`,
      result.summary,
      ...result.sections.map((section) => `${section.title}\n${section.content}`),
    ].join("\n\n");
  }, [result]);

  function updateField(name: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  function applyExample(example: string) {
    setForm((current) => ({ ...current, concept: example }));
    setErrors((current) => ({ ...current, concept: "" }));
  }

  function validate() {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};

    if (form.concept.trim().length < 14) {
      nextErrors.concept = "Describe the world in at least 14 characters.";
    }

    if (form.atmosphere.trim().length < 3) {
      nextErrors.atmosphere = "Add a short atmosphere or mood.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setLoadingStage(0);
    setGenerationError("");
    setResult(null);
    setCopied(false);

    try {
      const response = await fetch("/api/world", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const payload = (await response.json().catch(() => ({}))) as Partial<WorldResult> & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "The World Builder could not generate a result.");
      }

      if (!payload.sections?.length || !payload.worldName) {
        throw new Error("The World Builder returned an incomplete result.");
      }

      const baseResult = payload as WorldResult;
      setResult(baseResult);
      let finalResult: WorldResult = baseResult;
      if (baseResult.worldImageDataUrl) {
        setLoadingStage(LOADING_STAGES.length - 1);
        const model = await generateAutomaticModel({
          prompt: `${baseResult.layout?.landmarkPrompt || baseResult.worldImagePrompt}, large stylized 3D modular game-level diorama with several connected zones, visible paths, architecture, equipment and interactable landmarks, readable isometric composition, clean game-ready topology, cohesive hand-painted PBR materials, no sky dome, no characters, no text`,
          role: "environment",
          imageDataUrl: baseResult.worldImageDataUrl,
          faceLimit: 12000,
          onProgress: (progress, message) => {
            setModelProgress(progress);
            setModelMessage(message);
          },
        });
        finalResult = {
          ...baseResult,
          worldModelUrl: model.modelUrl,
          worldModelTaskId: model.taskId,
          worldModelStatus: model.status,
          worldModelMessage: model.message,
        };
        setResult(finalResult);
      }
      saveDesignStudioSection("world", { ...form, artStyle: "Stylized 3D" }, finalResult);
    } catch (error) {
      setGenerationError(
        error instanceof Error && error.message
          ? error.message
          : "The world could not be generated. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function resetTool() {
    setForm(INITIAL_FORM);
    setErrors({});
    setResult(null);
    setGenerationError("");
    setCopied(false);
    setLoadingStage(0);
    setModelProgress(0);
    setModelMessage("");
  }

  async function copyBlueprint() {
    if (!blueprintText) return;
    await navigator.clipboard.writeText(blueprintText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function downloadBlueprint() {
    if (!blueprintText || !result) return;
    const blob = new Blob([blueprintText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${result.worldName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-world-blueprint.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadWorldImage() {
    if (!result?.worldImageDataUrl) return;
    const anchor = document.createElement("a");
    anchor.href = result.worldImageDataUrl;
    anchor.download = `${result.worldName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-playable-map.png`;
    anchor.click();
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(34,211,238,.18),transparent_33%),radial-gradient(circle_at_82%_22%,rgba(59,130,246,.14),transparent_28%),linear-gradient(135deg,#040814,#030712_56%,#05020b)]" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:64px_64px]" />
      </div>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-20 pt-28 sm:px-8 sm:pt-32">
        <section className="grid items-center gap-8 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.32em] text-cyan-300">
              World architecture + visual generation
            </p>
            <h1 className="mt-4 text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              World Builder
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
              Describe a game world in natural language. GameForge AI will interpret the concept,
              build a coherent world blueprint, and render an impressive environment image that
              matches the idea.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm text-zinc-300">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
                Prompt-aware world design
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
                Playable 3D world map
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
                Download-ready blueprint
              </span>
            </div>
          </div>

          <div className="group relative h-[330px] overflow-hidden rounded-[30px] border border-white/10 bg-black/25 shadow-[0_30px_100px_rgba(0,0,0,.6)] sm:h-[420px]">
            <Image
              src="/cards/world.png"
              alt="GameForge World Builder"
              fill
              priority
              className="object-contain p-4 transition duration-700 group-hover:scale-[1.025]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
            <div className="absolute inset-x-6 bottom-6 rounded-2xl border border-cyan-300/15 bg-black/40 p-4 backdrop-blur-lg">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-300" />
                </span>
                Live world generation
              </div>
              <div className="mt-1 text-xs text-zinc-300">
                Structured worldbuilding, region planning, visual references, and an optional 3D landmark preview in one workflow.
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-4 rounded-[30px] border border-white/10 bg-white/[0.035] p-5 shadow-[0_20px_70px_rgba(0,0,0,.35)] backdrop-blur-xl sm:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">Quick start prompts</p>
            <h2 className="mt-2 text-2xl font-black">Need inspiration?</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => applyExample(example)}
                className="rounded-2xl border border-white/10 bg-black/25 p-4 text-left text-sm leading-6 text-zinc-300 transition hover:border-cyan-400/40 hover:bg-white/[0.045]"
              >
                {example}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-12 grid items-start gap-8 lg:grid-cols-[1fr_1fr]">
          <form
            onSubmit={handleSubmit}
            className="rounded-[30px] border border-white/10 bg-white/[0.035] p-5 shadow-[0_26px_90px_rgba(0,0,0,.5)] backdrop-blur-xl sm:p-8"
          >
            <div className="mb-7">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">Creative input</p>
              <h2 className="mt-2 text-3xl font-black">Describe the world you want</h2>
            </div>

            <div className="space-y-5">
              <div>
                <label htmlFor="concept" className="mb-2 block text-sm font-bold text-zinc-200">
                  World concept
                </label>
                <textarea
                  id="concept"
                  value={form.concept}
                  onChange={(event) => updateField("concept", event.target.value)}
                  placeholder="Describe the setting, hook, mystery, conflict, or visual fantasy you want the world to express..."
                  className={`min-h-40 w-full resize-y rounded-2xl border bg-black/35 p-4 text-white outline-none transition placeholder:text-zinc-600 ${errors.concept ? "border-red-500" : "border-white/10 focus:border-cyan-400/60 focus:shadow-[0_0_26px_rgba(34,211,238,.1)]"}`}
                />
                {errors.concept && <p className="mt-2 text-sm text-red-400">{errors.concept}</p>}
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <SelectField
                  id="scale"
                  label="World scale"
                  value={form.scale}
                  options={["Single city", "One region", "Continent", "Planet", "Multiple realms"]}
                  onChange={updateField}
                />
                <SelectField
                  id="focus"
                  label="Gameplay focus"
                  value={form.focus}
                  options={["Exploration Adventure", "Open-World RPG", "Survival", "Strategy", "Action Adventure", "Narrative Journey"]}
                  onChange={updateField}
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.055] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Locked production style</p>
                  <p className="mt-2 font-black text-white">Stylized 3D world</p>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">The structured map documents regions, routes, landmarks, and design logic, while the optional 3D preview supports presentation and spatial discussion.</p>
                </div>
                <div>
                  <label htmlFor="atmosphere" className="mb-2 block text-sm font-bold text-zinc-200">
                    Atmosphere / mood
                  </label>
                  <input
                    id="atmosphere"
                    value={form.atmosphere}
                    onChange={(event) => updateField("atmosphere", event.target.value)}
                    placeholder="Ancient, ominous, sacred, vibrant..."
                    className={`w-full rounded-2xl border bg-black/35 p-4 text-white outline-none transition placeholder:text-zinc-600 ${errors.atmosphere ? "border-red-500" : "border-white/10 focus:border-cyan-400/60"}`}
                  />
                  {errors.atmosphere && <p className="mt-2 text-sm text-red-400">{errors.atmosphere}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="visualNotes" className="mb-2 block text-sm font-bold text-zinc-200">
                  Extra visual notes (optional)
                </label>
                <textarea
                  id="visualNotes"
                  value={form.visualNotes}
                  onChange={(event) => updateField("visualNotes", event.target.value)}
                  placeholder="Mention architecture, weather, colors, creatures, technology, travel systems, or anything else you want emphasized."
                  className="min-h-28 w-full resize-y rounded-2xl border border-white/10 bg-black/35 p-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-400/60"
                />
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={loading}
                className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 px-6 font-black text-white shadow-[0_14px_45px_rgba(14,165,233,.25)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70"
              >
                {loading ? "Building Stylized 3D World..." : "Build Playable 3D World"}
              </button>
              <button
                type="button"
                onClick={resetTool}
                className="h-14 rounded-2xl border border-white/10 bg-white/[0.04] px-6 font-bold text-zinc-300 transition hover:bg-white/[0.08]"
              >
                Reset
              </button>
            </div>
          </form>

          <div className="rounded-[30px] border border-white/10 bg-gradient-to-br from-cyan-950/15 via-zinc-950/85 to-sky-950/20 p-5 shadow-[0_26px_90px_rgba(0,0,0,.5)] backdrop-blur-xl sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">Generated output</p>
                <h2 className="mt-2 text-3xl font-black">World Blueprint</h2>
              </div>
              {result && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={copyBlueprint}
                    className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-zinc-300 hover:bg-white/[0.06]"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={downloadBlueprint}
                    className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200 hover:bg-cyan-400/15"
                  >
                    Download Text
                  </button>
                  {result.worldImageDataUrl && (
                    <button
                      onClick={downloadWorldImage}
                      className="rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-sm font-bold text-sky-200 hover:bg-sky-400/15"
                    >
                      Download Image
                    </button>
                  )}
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-cyan-400/20 border-t-cyan-300" />
                <p className="mt-5 font-bold text-zinc-200">GameForge AI is building your world...</p>
                <p className="mt-2 text-sm text-zinc-500">{LOADING_STAGES[loadingStage]}</p>
              </div>
            ) : generationError ? (
              <div
                aria-live="polite"
                className="mt-7 rounded-3xl border border-red-400/20 bg-red-500/[0.08] p-6 text-left"
              >
                <p className="font-black text-red-200">World generation stopped</p>
                <p className="mt-2 leading-7 text-red-100/80">{generationError}</p>
              </div>
            ) : !result ? (
              <div className="flex min-h-[520px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/15 p-8 text-center">
                <div className="text-5xl">✦</div>
                <p className="mt-5 text-xl font-black">Your world will appear here</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
                  Enter a strong concept and GameForge AI will turn it into a complete world with
                  an advanced environment image.
                </p>
              </div>
            ) : (
              <div className="mt-7 space-y-6">
                <section className="space-y-4">
                  <ModelPreview3D
                    mode="world"
                    modelUrl={result.worldModelUrl}
                    layout={result.layout}
                    label={result.worldName}
                    status={result.worldModelStatus === "ready" ? "3D landmark connected to the World Bible preview" : result.worldModelMessage || "Detailed structured map rendered with planning landmarks"}
                  />

                  {result.worldImageDataUrl && (
                    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/35">
                      {/* The generated image is a local data URL and is intentionally rendered directly. */}
                      <img
                        src={result.worldImageDataUrl}
                        alt={`${result.worldName} detailed playable level map reference`}
                        className="aspect-[3/2] w-full object-cover"
                      />
                      <div className="border-t border-white/10 px-4 py-3 text-sm leading-6 text-zinc-400">
                        High-detail map reference. Gameforge uses the structured regions, routes, equipment, interactables, and prop coordinates below as the real playable 3D level source—not as a stretched blurry background.
                      </div>
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Regions</p><p className="mt-2 text-2xl font-black">{result.layout?.regions?.length || 0}</p></div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Map elements</p><p className="mt-2 text-2xl font-black">{result.layout?.props?.length || 0}</p></div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Interactables</p><p className="mt-2 text-2xl font-black text-cyan-200">{result.layout?.props?.filter((prop) => prop.interactive).length || 0}</p></div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Map reference</p><p className="mt-2 text-sm font-black text-fuchsia-200">{result.worldImageMeta ? `${result.worldImageMeta.width} × ${result.worldImageMeta.height}` : "High detail"}</p></div>
                  </div>
                </section>

                {result.generationWarning && (
                  <div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/[0.08] p-4 text-sm leading-6 text-cyan-100/85">
                    {result.generationWarning}
                  </div>
                )}

                {result.worldImageError && (
                  <div className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.08] p-4 text-sm leading-6 text-amber-100/80">
                    {result.worldImageError}
                  </div>
                )}

                <article className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.06] p-5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">World summary</p>
                  <h3 className="mt-2 text-2xl font-black text-white">
                    {result.worldName} — {result.worldTagline}
                  </h3>
                  <p className="mt-3 leading-7 text-zinc-300">{result.summary}</p>
                </article>

                <div className="space-y-4">
                  {result.sections.map((section) => (
                    <article
                      key={section.title}
                      className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-left"
                    >
                      <div className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                        {section.title}
                      </div>
                      <p className="whitespace-pre-line leading-7 text-zinc-300">{section.content}</p>
                    </article>
                  ))}
                </div>

              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
