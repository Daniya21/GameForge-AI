"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { saveDesignStudioSection } from "@/lib/game-project/client";

type FormState = {
  prompt: string;
  questType: string;
  setting: string;
  tone: string;
  difficulty: string;
  rewardPreference: string;
  specialRequirements: string;
};

type ResultSection = {
  title: string;
  content: string;
};

type QuestResult = {
  questTitle: string;
  questSubtitle: string;
  summary: string;
  sections: ResultSection[];
};

const INITIAL_FORM: FormState = {
  prompt: "",
  questType: "Side Quest",
  setting: "",
  tone: "Mysterious",
  difficulty: "Moderate",
  rewardPreference: "",
  specialRequirements: "",
};

const EXAMPLES = [
  "A village's shadows begin speaking at night, but only one child understands what they are warning about.",
  "The player must escort an enemy commander through territory destroyed by the commander's own army.",
  "A city celebrates a hero who never existed, and the player is hired to discover why everyone remembers the same false person.",
];

const LOADING_STAGES = [
  "Understanding the quest prompt",
  "Building characters and objective logic",
  "Designing choices and consequences",
  "Balancing rewards and world-state changes",
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
        className="w-full rounded-2xl border border-white/10 bg-zinc-950 p-4 text-white outline-none transition focus:border-amber-300/60 focus:shadow-[0_0_24px_rgba(250,204,21,.10)]"
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

export default function QuestsPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [result, setResult] = useState<QuestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [generationError, setGenerationError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading) return;

    const timer = window.setInterval(() => {
      setLoadingStage((current) =>
        current < LOADING_STAGES.length - 1 ? current + 1 : current,
      );
    }, 1900);

    return () => window.clearInterval(timer);
  }, [loading]);

  const questText = useMemo(() => {
    if (!result) return "";

    return [
      `${result.questTitle} — ${result.questSubtitle}`,
      result.summary,
      ...result.sections.map((section) => `${section.title}\n${section.content}`),
    ].join("\n\n");
  }, [result]);

  function updateField(name: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  function applyExample(example: string) {
    setForm((current) => ({ ...current, prompt: example }));
    setErrors((current) => ({ ...current, prompt: "" }));
  }

  function validate() {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};

    if (form.prompt.trim().length < 12) {
      nextErrors.prompt = "Describe the quest idea in at least 12 characters.";
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
      const response = await fetch("/api/quest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const payload = (await response.json().catch(() => ({}))) as Partial<QuestResult> & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "The Quest Generator could not generate a result.");
      }

      if (!payload.sections?.length || !payload.questTitle) {
        throw new Error("The Quest Generator returned an incomplete result.");
      }

      setResult(payload as QuestResult);
      saveDesignStudioSection("quests", form, payload as QuestResult);
    } catch (error) {
      setGenerationError(
        error instanceof Error && error.message
          ? error.message
          : "The quest could not be generated. Please try again.",
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
  }

  async function copyQuest() {
    if (!questText) return;
    await navigator.clipboard.writeText(questText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function downloadQuest() {
    if (!questText || !result) return;
    const blob = new Blob([questText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${result.questTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-quest.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(250,204,21,.13),transparent_34%),radial-gradient(circle_at_82%_24%,rgba(249,115,22,.12),transparent_30%),linear-gradient(135deg,#0b0803,#050711_56%,#090309)]" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:64px_64px]" />
      </div>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-20 pt-28 sm:px-8 sm:pt-32">
        <section className="grid items-center gap-8 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.32em] text-amber-300">
              Mission design + branching consequences
            </p>
            <h1 className="mt-4 text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Quest Generator
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
              Give GameForge AI a simple or detailed quest idea. It will understand the prompt and
              turn it into a playable mission with objectives, characters, choices, rewards, failure
              handling, and consequences that persist in the world.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm text-zinc-300">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
                Prompt-faithful design
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
                Logical objective chain
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
                Meaningful consequences
              </span>
            </div>
          </div>

          <div className="group relative h-[330px] overflow-hidden rounded-[30px] border border-white/10 bg-black/25 shadow-[0_30px_100px_rgba(0,0,0,.6)] sm:h-[420px]">
            <Image
              src="/cards/quests.png"
              alt="GameForge Quest Generator"
              fill
              priority
              className="object-contain p-4 transition duration-700 group-hover:scale-[1.025]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
            <div className="absolute inset-x-6 bottom-6 rounded-2xl border border-amber-300/15 bg-black/40 p-4 backdrop-blur-lg">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-300" />
                </span>
                Intelligent quest generation
              </div>
              <div className="mt-1 text-xs text-zinc-300">
                From raw hook to implementation-ready quest structure.
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-4 rounded-[30px] border border-white/10 bg-white/[0.035] p-5 shadow-[0_20px_70px_rgba(0,0,0,.35)] backdrop-blur-xl sm:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-300">Quick start prompts</p>
            <h2 className="mt-2 text-2xl font-black">Try a quest hook</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => applyExample(example)}
                className="rounded-2xl border border-white/10 bg-black/25 p-4 text-left text-sm leading-6 text-zinc-300 transition hover:border-amber-300/40 hover:bg-white/[0.045]"
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
              <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-300">Creative input</p>
              <h2 className="mt-2 text-3xl font-black">Tell the AI what should happen</h2>
            </div>

            <div className="space-y-5">
              <div>
                <label htmlFor="prompt" className="mb-2 block text-sm font-bold text-zinc-200">
                  Quest prompt
                </label>
                <textarea
                  id="prompt"
                  value={form.prompt}
                  onChange={(event) => updateField("prompt", event.target.value)}
                  placeholder="Describe the mission, problem, character, location, desired twist, or outcome in your own words..."
                  className={`min-h-40 w-full resize-y rounded-2xl border bg-black/35 p-4 text-white outline-none transition placeholder:text-zinc-600 ${errors.prompt ? "border-red-500" : "border-white/10 focus:border-amber-300/60 focus:shadow-[0_0_26px_rgba(250,204,21,.08)]"}`}
                />
                {errors.prompt && <p className="mt-2 text-sm text-red-400">{errors.prompt}</p>}
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <SelectField
                  id="questType"
                  label="Quest type"
                  value={form.questType}
                  options={["Main Quest", "Side Quest", "Companion Quest", "Mystery Quest", "Boss Quest", "Exploration Quest"]}
                  onChange={updateField}
                />
                <SelectField
                  id="tone"
                  label="Quest tone"
                  value={form.tone}
                  options={["Epic", "Dark", "Emotional", "Mysterious", "Heroic", "Comedic"]}
                  onChange={updateField}
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <SelectField
                  id="difficulty"
                  label="Difficulty"
                  value={form.difficulty}
                  options={["Accessible", "Moderate", "Challenging", "Brutal"]}
                  onChange={updateField}
                />
                <div>
                  <label htmlFor="rewardPreference" className="mb-2 block text-sm font-bold text-zinc-200">
                    Preferred reward (optional)
                  </label>
                  <input
                    id="rewardPreference"
                    value={form.rewardPreference}
                    onChange={(event) => updateField("rewardPreference", event.target.value)}
                    placeholder="Unique ability, weapon, ally, access..."
                    className="w-full rounded-2xl border border-white/10 bg-black/35 p-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-300/60"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="setting" className="mb-2 block text-sm font-bold text-zinc-200">
                  Game world / setting (optional)
                </label>
                <textarea
                  id="setting"
                  value={form.setting}
                  onChange={(event) => updateField("setting", event.target.value)}
                  placeholder="Describe the world, region, era, faction, or current situation the quest must fit into."
                  className="min-h-28 w-full resize-y rounded-2xl border border-white/10 bg-black/35 p-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-300/60"
                />
              </div>

              <div>
                <label htmlFor="specialRequirements" className="mb-2 block text-sm font-bold text-zinc-200">
                  Special requirements (optional)
                </label>
                <textarea
                  id="specialRequirements"
                  value={form.specialRequirements}
                  onChange={(event) => updateField("specialRequirements", event.target.value)}
                  placeholder="Examples: no combat, three endings, include stealth, protect an NPC, time pressure, moral choice..."
                  className="min-h-28 w-full resize-y rounded-2xl border border-white/10 bg-black/35 p-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-300/60"
                />
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={loading}
                className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-fuchsia-600 px-6 font-black text-white shadow-[0_14px_45px_rgba(249,115,22,.20)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70"
              >
                {loading ? "Generating..." : "Generate Quest"}
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

          <div className="rounded-[30px] border border-white/10 bg-gradient-to-br from-amber-950/10 via-zinc-950/85 to-orange-950/15 p-5 shadow-[0_26px_90px_rgba(0,0,0,.5)] backdrop-blur-xl sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-300">Generated result</p>
                <h2 className="mt-2 text-3xl font-black">Quest Design</h2>
              </div>
              {result && (
                <div className="flex gap-2">
                  <button
                    onClick={copyQuest}
                    className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-zinc-300 hover:bg-white/[0.06]"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={downloadQuest}
                    className="rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-sm font-bold text-amber-100 hover:bg-amber-300/15"
                  >
                    Download
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-amber-300/20 border-t-amber-300" />
                <p className="mt-5 font-bold text-zinc-200">GameForge AI is designing your quest...</p>
                <p className="mt-2 text-sm text-zinc-500">{LOADING_STAGES[loadingStage]}</p>
              </div>
            ) : generationError ? (
              <div
                aria-live="polite"
                className="mt-7 rounded-3xl border border-red-400/20 bg-red-500/[0.08] p-6 text-left"
              >
                <p className="font-black text-red-200">Quest generation stopped</p>
                <p className="mt-2 leading-7 text-red-100/80">{generationError}</p>
              </div>
            ) : !result ? (
              <div className="flex min-h-[520px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/15 p-8 text-center">
                <div className="text-5xl">✦</div>
                <p className="mt-5 text-xl font-black">Your quest will appear here</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
                  Enter any quest concept. The AI will interpret it and create a structured mission
                  without replacing your idea with a generic template.
                </p>
              </div>
            ) : (
              <div className="mt-7 space-y-4">
                <article className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.055] p-5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">Quest identity</p>
                  <h3 className="mt-2 text-2xl font-black text-white">
                    {result.questTitle} — {result.questSubtitle}
                  </h3>
                  <p className="mt-3 leading-7 text-zinc-300">{result.summary}</p>
                </article>

                {result.sections.map((section) => (
                  <article
                    key={section.title}
                    className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-left"
                  >
                    <div className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-amber-300">
                      {section.title}
                    </div>
                    <p className="whitespace-pre-line leading-7 text-zinc-300">{section.content}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        {result && (
          <div className="mt-8">
            
          </div>
        )}
      </main>
    </div>
  );
}
