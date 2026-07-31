"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import ModelPreview3D from "../components/game/ModelPreview3D";
import { generateAutomaticModel } from "@/lib/game-assets/automatic-3d";
import { saveDesignStudioSection } from "@/lib/game-project/client";

type FormState = {
  concept: string;
  world: string;
  archetype: string;
  artStyle: string;
  framing: string;
  visualNotes: string;
};

type ResultSection = {
  title: string;
  content: string;
};

type CharacterResult = {
  characterName: string;
  characterEpithet: string;
  summary: string;
  sections: ResultSection[];
  avatarPrompt: string;
  avatarDataUrl: string | null;
  avatarError: string | null;
  modelUrl?: string;
  modelTaskId?: string;
  modelPreviewUrl?: string;
  modelStatus?: "ready" | "unavailable" | "failed";
  modelMessage?: string;
};

const INITIAL_FORM: FormState = {
  concept: "",
  world: "",
  archetype: "Hero",
  artStyle: "Stylized 3D",
  framing: "Full-Body Character Card",
  visualNotes: "",
};

const EXAMPLES = [
  "A former royal healer who now hunts the plague spirits she accidentally created.",
  "A young desert engineer who controls ancient machines through music.",
  "An immortal city guard who secretly forgets one memory every time he survives death.",
];

const LOADING_STAGES = [
  "Understanding the character concept",
  "Building personality, history, and gameplay identity",
  "Designing the visual silhouette",
  "Rendering the full-body Cloudflare reference",
  "Preparing the optional 3D character reference",
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
        className="w-full rounded-2xl border border-white/10 bg-zinc-950 p-4 text-white outline-none transition focus:border-fuchsia-400/60 focus:shadow-[0_0_24px_rgba(232,121,249,.12)]"
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

export default function CharactersPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [result, setResult] = useState<CharacterResult | null>(null);
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

  const profileText = useMemo(() => {
    if (!result) return "";

    return [
      `${result.characterName} — ${result.characterEpithet}`,
      result.summary,
      ...result.sections.map((section) => `${section.title}\n${section.content}`),
    ].join("\n\n");
  }, [result]);

  function updateField(name: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  function validate() {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};

    if (form.concept.trim().length < 12) {
      nextErrors.concept = "Describe the character in at least 12 characters.";
    }

    if (form.world.trim().length < 8) {
      nextErrors.world = "Describe the world or setting in at least 8 characters.";
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
      const response = await fetch("/api/character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const payload = (await response.json().catch(() => ({}))) as Partial<CharacterResult> & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "The Character AI could not generate a result.");
      }

      if (!payload.sections?.length || !payload.characterName) {
        throw new Error("The Character AI returned an incomplete result.");
      }

      const baseResult = payload as CharacterResult;
      setResult(baseResult);
      let finalResult: CharacterResult = baseResult;
      if (baseResult.avatarDataUrl) {
        setLoadingStage(LOADING_STAGES.length - 1);
        const model = await generateAutomaticModel({
          prompt: `${baseResult.avatarPrompt}, single playable hero, stylized 3D game character, full body, neutral A-pose, clean topology, symmetrical stance, no environment, no text`,
          role: "player",
          imageDataUrl: baseResult.avatarDataUrl,
          faceLimit: 6500,
          onProgress: (progress, message) => {
            setModelProgress(progress);
            setModelMessage(message);
          },
        });
        finalResult = {
          ...baseResult,
          modelUrl: model.modelUrl,
          modelTaskId: model.taskId,
          modelPreviewUrl: model.previewUrl,
          modelStatus: model.status,
          modelMessage: model.message,
        };
        setResult(finalResult);
      }
      saveDesignStudioSection("characters", { ...form, artStyle: "Stylized 3D", framing: "Full-Body Character Card" }, finalResult);
    } catch (error) {
      setGenerationError(
        error instanceof Error && error.message
          ? error.message
          : "The character could not be generated. Please try again.",
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

  async function copyProfile() {
    if (!profileText) return;
    await navigator.clipboard.writeText(profileText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function downloadProfile() {
    if (!profileText || !result) return;
    const blob = new Blob([profileText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${result.characterName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-profile.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadAvatar() {
    if (!result?.avatarDataUrl) return;
    const anchor = document.createElement("a");
    anchor.href = result.avatarDataUrl;
    anchor.download = `${result.characterName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-avatar.jpg`;
    anchor.click();
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(217,70,239,.20),transparent_34%),radial-gradient(circle_at_82%_24%,rgba(34,211,238,.16),transparent_30%),linear-gradient(135deg,#090311,#020714_56%,#06020b)]" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:64px_64px]" />
      </div>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-20 pt-28 sm:px-8 sm:pt-32">
        <section className="grid items-center gap-8 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.32em] text-fuchsia-300">
              Cast design + visual generation
            </p>
            <h1 className="mt-4 text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Character Creator
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
              Describe a person in natural language. GameForge AI will understand the idea,
              build one complete playable character, generate a full-body stylized reference, and connect the resulting 3D GLB to the shared Game Project.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm text-zinc-300">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
                Prompt-aware profile
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
                Optional 3D Reference
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
                Download-ready assets
              </span>
            </div>
          </div>

          <div className="group relative h-[330px] overflow-hidden rounded-[30px] border border-white/10 bg-black/25 shadow-[0_30px_100px_rgba(0,0,0,.6)] sm:h-[420px]">
            <Image
              src="/cards/characters.png"
              alt="GameForge Character Creator"
              fill
              priority
              className="object-contain p-4 transition duration-700 group-hover:scale-[1.025]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
            <div className="absolute inset-x-6 bottom-6 rounded-2xl border border-fuchsia-300/15 bg-black/40 p-4 backdrop-blur-lg">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fuchsia-300 opacity-70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-fuchsia-300" />
                </span>
                Live character visualization
              </div>
              <div className="mt-1 text-xs text-zinc-300">
                The written design and avatar are generated from the same character DNA.
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12 grid items-start gap-8 lg:grid-cols-[.92fr_1.08fr]">
          <form
            onSubmit={handleSubmit}
            className="rounded-[30px] border border-white/10 bg-white/[0.035] p-5 shadow-[0_26px_90px_rgba(0,0,0,.5)] backdrop-blur-xl sm:p-8"
          >
            <div className="mb-7">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-fuchsia-300">
                Creative input
              </p>
              <h2 className="mt-2 text-3xl font-black">Describe your character</h2>
            </div>

            <div className="space-y-5">
              <div>
                <label htmlFor="concept" className="mb-2 block text-sm font-bold text-zinc-200">
                  Character concept
                </label>
                <textarea
                  id="concept"
                  value={form.concept}
                  maxLength={1800}
                  onChange={(event) => updateField("concept", event.target.value)}
                  placeholder="Example: A battle-scarred royal healer who uses forbidden spirit magic and fears becoming the same monster she hunts."
                  className={`min-h-40 w-full resize-y rounded-2xl border bg-black/35 p-4 text-white outline-none transition placeholder:text-zinc-600 ${
                    errors.concept
                      ? "border-red-500"
                      : "border-white/10 focus:border-fuchsia-400/60 focus:shadow-[0_0_26px_rgba(232,121,249,.1)]"
                  }`}
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-sm text-red-400">{errors.concept || ""}</p>
                  <span className="text-xs text-zinc-600">{form.concept.length}/1800</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {EXAMPLES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => updateField("concept", example)}
                      className="rounded-full border border-fuchsia-400/15 bg-fuchsia-400/[0.07] px-3 py-2 text-left text-xs text-fuchsia-100 transition hover:border-fuchsia-300/40 hover:bg-fuchsia-400/[0.13]"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="world" className="mb-2 block text-sm font-bold text-zinc-200">
                  World or setting
                </label>
                <textarea
                  id="world"
                  value={form.world}
                  maxLength={1400}
                  onChange={(event) => updateField("world", event.target.value)}
                  placeholder="Example: Floating kingdoms above a poisoned ocean where memories are traded as currency."
                  className={`min-h-28 w-full resize-y rounded-2xl border bg-black/35 p-4 text-white outline-none transition placeholder:text-zinc-600 ${
                    errors.world
                      ? "border-red-500"
                      : "border-white/10 focus:border-cyan-400/60 focus:shadow-[0_0_26px_rgba(34,211,238,.1)]"
                  }`}
                />
                {errors.world && <p className="mt-2 text-sm text-red-400">{errors.world}</p>}
              </div>

              <SelectField
                id="archetype"
                label="Archetype"
                value={form.archetype}
                options={["Hero", "Antihero", "Mentor", "Rival", "Villain", "Companion"]}
                onChange={updateField}
              />

              <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.055] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Locked production style</p>
                <p className="mt-2 font-black text-white">Stylized 3D · Full-body game model</p>
                <p className="mt-1 text-sm leading-6 text-zinc-400">Cloudflare creates a clean full-body concept reference, and an optional 3D model can support the Character Bible and presentation package.</p>
              </div>

              <div>
                <label htmlFor="visualNotes" className="mb-2 block text-sm font-bold text-zinc-200">
                  Visual details <span className="font-normal text-zinc-500">(optional)</span>
                </label>
                <input
                  id="visualNotes"
                  value={form.visualNotes}
                  maxLength={700}
                  onChange={(event) => updateField("visualNotes", event.target.value)}
                  placeholder="Example: silver braided hair, mechanical left arm, cracked gold mask, tired blue eyes"
                  className="w-full rounded-2xl border border-white/10 bg-black/35 p-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-400/60"
                />
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={loading}
                className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-cyan-500 px-6 font-black text-white shadow-[0_14px_45px_rgba(139,92,246,.28)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70"
              >
                {loading ? "Creating Stylized 3D Character..." : "Create Playable 3D Character"}
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

          <div className="min-h-[680px] rounded-[30px] border border-white/10 bg-gradient-to-br from-fuchsia-950/15 via-zinc-950/85 to-cyan-950/20 p-5 shadow-[0_26px_90px_rgba(0,0,0,.5)] backdrop-blur-xl sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
                  Generated result
                </p>
                <h2 className="mt-2 text-3xl font-black">
                  {result ? result.characterName : "Character Profile"}
                </h2>
                {result && <p className="mt-1 text-sm text-fuchsia-200">{result.characterEpithet}</p>}
              </div>
              {result && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={copyProfile}
                    className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-zinc-300 hover:bg-white/[0.06]"
                  >
                    {copied ? "Copied" : "Copy Profile"}
                  </button>
                  <button
                    type="button"
                    onClick={downloadProfile}
                    className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200 hover:bg-cyan-400/15"
                  >
                    Download Profile
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex min-h-[540px] flex-col items-center justify-center text-center">
                <div className="relative h-28 w-28">
                  <div className="absolute inset-0 animate-ping rounded-full border border-fuchsia-400/25" />
                  <div className="absolute inset-3 animate-pulse rounded-full border border-cyan-300/35" />
                  <div className="absolute inset-7 animate-spin rounded-full border-4 border-violet-500/20 border-t-cyan-300" />
                  <div className="absolute inset-0 flex items-center justify-center text-3xl">✦</div>
                </div>
                <p className="mt-7 text-lg font-black text-zinc-100">{LOADING_STAGES[loadingStage]}</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
                  The profile and avatar are being designed from the same prompt, so the visual matches the written character.
                </p>
                <div className="mt-6 flex gap-2">
                  {LOADING_STAGES.map((stage, index) => (
                    <span
                      key={stage}
                      className={`h-1.5 w-10 rounded-full transition ${
                        index <= loadingStage ? "bg-gradient-to-r from-fuchsia-400 to-cyan-300" : "bg-white/10"
                      }`}
                    />
                  ))}
                </div>
              </div>
            ) : generationError ? (
              <div className="mt-7 rounded-3xl border border-red-400/20 bg-red-500/[0.08] p-6 text-left">
                <p className="font-black text-red-200">Character generation stopped</p>
                <p className="mt-2 leading-7 text-red-100/80">{generationError}</p>
              </div>
            ) : !result ? (
              <div className="flex min-h-[540px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/15 p-8 text-center">
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-fuchsia-300/20 bg-fuchsia-400/[0.06] text-5xl shadow-[0_0_50px_rgba(217,70,239,.15)]">
                  ◈
                  <span className="absolute -right-1 top-2 h-3 w-3 animate-ping rounded-full bg-cyan-300" />
                </div>
                <p className="mt-6 text-xl font-black">Your character will come alive here</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
                  Give the AI a clear idea, world, and visual direction. It will create the biography, gameplay role, and matching avatar together.
                </p>
              </div>
            ) : (
              <div className="mt-7 space-y-5">
                <section className="grid gap-5 xl:grid-cols-[minmax(320px,1fr)_1fr]">
                  <ModelPreview3D
                    mode="character"
                    modelUrl={result.modelUrl}
                    label={result.characterName}
                    status={result.modelStatus === "ready" ? "3D character reference connected to the project" : result.modelMessage || "Stylized procedural fallback ready"}
                  />

                  <div className="flex flex-col justify-center rounded-[26px] border border-white/10 bg-white/[0.035] p-6">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-fuchsia-300">Playable character DNA</p>
                    <h3 className="mt-3 text-3xl font-black leading-tight">{result.characterName}</h3>
                    <p className="mt-1 font-bold text-cyan-200">{result.characterEpithet}</p>
                    <p className="mt-5 leading-7 text-zinc-300">{result.summary}</p>
                    <div className="mt-6 grid gap-2 text-xs sm:grid-cols-2">
                      <span className="rounded-xl border border-fuchsia-300/15 bg-fuchsia-300/[0.07] px-3 py-2 text-fuchsia-100">Single playable character</span>
                      <span className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.07] px-3 py-2 text-cyan-100">Stylized 3D only</span>
                      <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-zinc-300">Cloudflare reference</span>
                      <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-zinc-300">{result.modelStatus === "ready" ? "3D reference ready" : "Fallback model ready"}</span>
                    </div>
                    {loading && loadingStage === LOADING_STAGES.length - 1 ? (
                      <div className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] p-4">
                        <div className="flex items-center justify-between text-xs"><span className="font-black text-cyan-100">{modelMessage || "Generating 3D model"}</span><span>{modelProgress}%</span></div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-300" style={{ width: `${modelProgress}%` }} /></div>
                      </div>
                    ) : null}
                  </div>
                </section>

                {result.avatarError && (
                  <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-4 text-sm leading-6 text-amber-100">
                    {result.avatarError}
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  {result.sections.map((section, index) => (
                    <article
                      key={`${section.title}-${index}`}
                      className={`rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-left ${
                        section.title === "Backstory" || section.title === "Gameplay Identity"
                          ? "md:col-span-2"
                          : ""
                      }`}
                    >
                      <div className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">
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
