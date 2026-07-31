"use client";

import Link from "next/link";
import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { GameProject } from "@/app/types/game-project";
import {
  GAME_PROJECT_EVENT,
  getOrCreateActiveGameProject,
  saveDesignStudioSection,
} from "@/lib/game-project/client";

type FormState = {
  prompt: string;
  characters: string;
  format: string;
  tone: string;
  length: string;
  intensity: string;
  sceneGoal: string;
  specialRequirements: string;
};

type DialogueLine = {
  speaker: string;
  line: string;
  direction: string;
};

type DialogueResult = {
  sceneTitle: string;
  sceneSubtitle: string;
  summary: string;
  sceneSetup: string;
  characterVoiceGuide: string[];
  dialogueLines: DialogueLine[];
  emotionalBeats: string[];
  branchingChoices: string[];
  subtextAndIntent: string;
  performanceDirection: string;
  continuityAndConsequences: string;
  implementationNotes: string;
};

const INITIAL_FORM: FormState = {
  prompt: "",
  characters: "",
  format: "Cinematic Cutscene",
  tone: "Tense",
  length: "Standard",
  intensity: "High Stakes",
  sceneGoal: "",
  specialRequirements: "",
};

const LOADING_STAGES = [
  "Understanding the scene and character relationships",
  "Building distinct voices and natural conflict",
  "Writing the full dialogue scene",
  "Checking continuity and implementation notes",
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
      <label htmlFor={id} className="mb-2 block text-sm font-bold text-zinc-300">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(id, event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-[#06050d] px-4 py-3.5 text-white outline-none transition focus:border-violet-300/55"
      >
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </div>
  );
}

function isDialogueResult(payload: Partial<DialogueResult>): payload is DialogueResult {
  return Boolean(
    payload.sceneTitle &&
    payload.sceneSubtitle &&
    payload.summary &&
    payload.sceneSetup &&
    Array.isArray(payload.characterVoiceGuide) &&
    payload.characterVoiceGuide.length &&
    Array.isArray(payload.dialogueLines) &&
    payload.dialogueLines.length &&
    Array.isArray(payload.emotionalBeats) &&
    Array.isArray(payload.branchingChoices) &&
    payload.subtextAndIntent &&
    payload.performanceDirection &&
    payload.continuityAndConsequences &&
    payload.implementationNotes,
  );
}

function projectCharacterText(project: GameProject) {
  return project.designStudio.characters
    .map((entry) => {
      if (!entry.result || typeof entry.result !== "object" || Array.isArray(entry.result)) return "";
      const record = entry.result as Record<string, unknown>;
      const name = typeof record.characterName === "string" ? record.characterName : "";
      const epithet = typeof record.characterEpithet === "string" ? record.characterEpithet : "";
      const summary = typeof record.summary === "string" ? record.summary : "";
      if (!name) return "";
      return `${name}${epithet ? ` — ${epithet}` : ""}${summary ? `; ${summary}` : ""}`;
    })
    .filter(Boolean)
    .join("\n");
}

export default function DialoguePage() {
  const [project, setProject] = useState<GameProject | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [result, setResult] = useState<DialogueResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [generationError, setGenerationError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = (next: GameProject) => setProject(next);
    const frame = window.requestAnimationFrame(() => load(getOrCreateActiveGameProject()));
    const onUpdate = (event: Event) => load((event as CustomEvent<GameProject>).detail ?? getOrCreateActiveGameProject());
    window.addEventListener(GAME_PROJECT_EVENT, onUpdate);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(GAME_PROJECT_EVENT, onUpdate);
    };
  }, []);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => setLoadingStage((current) => Math.min(current + 1, LOADING_STAGES.length - 1)), 1700);
    return () => window.clearInterval(timer);
  }, [loading]);

  const scriptText = useMemo(() => {
    if (!result) return "";
    const dialogue = result.dialogueLines
      .map((item) => `${item.speaker.toUpperCase()}${item.direction ? ` (${item.direction})` : ""}\n${item.line}`)
      .join("\n\n");
    return [
      `${result.sceneTitle} — ${result.sceneSubtitle}`,
      `SUMMARY\n${result.summary}`,
      `SCENE SETUP\n${result.sceneSetup}`,
      `VOICE GUIDE\n${result.characterVoiceGuide.join("\n")}`,
      `DIALOGUE\n${dialogue}`,
      result.branchingChoices.length ? `PLAYER CHOICES\n${result.branchingChoices.join("\n")}` : "",
      `SUBTEXT AND INTENT\n${result.subtextAndIntent}`,
      `PERFORMANCE DIRECTION\n${result.performanceDirection}`,
      `CONTINUITY AND CONSEQUENCES\n${result.continuityAndConsequences}`,
      `IMPLEMENTATION NOTES\n${result.implementationNotes}`,
    ].filter(Boolean).join("\n\n");
  }, [result]);

  function updateField(name: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  function useProjectCharacters() {
    if (!project) return;
    const cast = projectCharacterText(project);
    if (!cast) return;
    updateField("characters", cast);
  }

  function validate() {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (form.prompt.trim().length < 14) next.prompt = "Describe the scene in at least 14 characters.";
    if (form.characters.trim().length < 4) next.characters = "Add at least two characters or speaking roles.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setLoadingStage(0);
    setGenerationError("");
    setCopied(false);
    setResult(null);

    try {
      const response = await fetch("/api/dialogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<DialogueResult> & { error?: string };
      if (!response.ok) throw new Error(payload.error || "The Dialogue Generator could not create the scene.");
      if (!isDialogueResult(payload)) throw new Error("The AI returned an incomplete dialogue scene. Generate it again.");

      setResult(payload);
      saveDesignStudioSection("dialogue", form, payload);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "The dialogue scene could not be generated. Please try again.");
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

  async function copyScript() {
    if (!scriptText) return;
    await navigator.clipboard.writeText(scriptText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function download(kind: "txt" | "json") {
    if (!result) return;
    const content = kind === "json" ? JSON.stringify(result, null, 2) : scriptText;
    const blob = new Blob([content], { type: kind === "json" ? "application/json" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${result.sceneTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-dialogue.${kind}`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  const hasProjectCharacters = Boolean(project && projectCharacterText(project));

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05040b] px-5 pb-24 pt-28 text-white sm:px-8 sm:pt-32">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_14%,rgba(37,99,235,.13),transparent_34%),radial-gradient(circle_at_88%_18%,rgba(168,85,247,.16),transparent_32%),radial-gradient(circle_at_52%_82%,rgba(217,70,239,.10),transparent_34%)]" />

      <div className="mx-auto w-full max-w-[1480px]">
      <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-gradient-to-br from-violet-950/80 via-[#090711] to-cyan-950/35 p-6 shadow-[0_30px_110px_rgba(0,0,0,.5)] sm:p-9 lg:p-12">
  <div className="pointer-events-none absolute -left-24 top-10 h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
  <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />

  <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_.95fr]">
    <div>
      <p className="text-xs font-black uppercase tracking-[0.32em] text-fuchsia-300">
        Dialogue Design + Narrative Generation
      </p>

      <h1 className="mt-6 text-5xl font-black tracking-[-0.045em] sm:text-6xl lg:text-7xl">
        Dialogue Generator
      </h1>

      <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-400 sm:text-xl">
        Describe a scene, conflict, and cast. GameForge creates cinematic
        conversations, distinct character voices, emotional beats, branching
        choices, and implementation-ready dialogue.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        {[
          "Emotion-aware dialogue",
          "Branching choices",
          "Game-ready scripts",
        ].map((feature) => (
          <span
            key={feature}
            className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-zinc-300"
          >
            {feature}
          </span>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm">
          <span className="text-zinc-500">Active project:</span>
          <strong className="ml-1 text-white">
            {project?.title || "Loading..."}
          </strong>
        </div>

        <Link
          href="/design-studio"
          className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] px-5 text-sm font-black text-zinc-200 transition hover:bg-white/[0.08]"
        >
          ← Design Studio
        </Link>
      </div>
    </div>

    <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-black/30 p-3 shadow-2xl">
      <div className="relative aspect-[16/10] overflow-hidden rounded-[22px]">
        <img
          src="/cards/dialogue.png"
          alt="GameForge Dialogue Generator"
          className="h-full w-full object-cover"
        />
      </div>

      <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-violet-300/20 bg-[#07060d]/90 p-4 backdrop-blur-xl">
        <p className="font-black text-white">
          <span className="mr-2 text-fuchsia-300">●</span>
          Live dialogue visualization
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          Character voices, emotional beats, and branching choices stay
          connected to the active Game Project.
        </p>
      </div>
    </div>
  </div>
</section>

        <section className="mt-10 grid gap-7 xl:grid-cols-[.9fr_1.1fr]">
          <form onSubmit={handleSubmit} className="h-fit rounded-[30px] border border-white/10 bg-[#090711]/88 p-5 shadow-[0_26px_90px_rgba(0,0,0,.4)] backdrop-blur-xl sm:p-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-fuchsia-300">Scene input</p>
              <h2 className="mt-2 text-3xl font-black">Create the conversation</h2>
            </div>

            <div className="mt-7 space-y-6">
              <div>
                <label htmlFor="prompt" className="mb-2 block text-sm font-bold text-zinc-300">What happens in the scene?</label>
                <textarea id="prompt" value={form.prompt} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateField("prompt", event.target.value)} rows={6} placeholder="Describe the location, conflict, reveal, relationship, and desired outcome." className="w-full resize-y rounded-2xl border border-white/10 bg-[#05040b] p-4 leading-7 text-white outline-none transition placeholder:text-zinc-700 focus:border-violet-300/60" />
                {errors.prompt ? <p className="mt-2 text-sm font-bold text-rose-300">{errors.prompt}</p> : null}
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <label htmlFor="characters" className="block text-sm font-bold text-zinc-300">Characters and speaking style</label>
                  {hasProjectCharacters ? <button type="button" onClick={useProjectCharacters} className="text-xs font-black text-violet-300">Use generated project characters</button> : null}
                </div>
                <textarea id="characters" value={form.characters} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateField("characters", event.target.value)} rows={5} placeholder="Name — role, personality, hidden motive, relationship, and speaking style." className="w-full resize-y rounded-2xl border border-white/10 bg-[#05040b] p-4 leading-7 text-white outline-none transition placeholder:text-zinc-700 focus:border-violet-300/60" />
                {errors.characters ? <p className="mt-2 text-sm font-bold text-rose-300">{errors.characters}</p> : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField id="format" label="Dialogue format" value={form.format} options={["Cinematic Cutscene", "Interactive Conversation", "Branching Dialogue", "Quest Dialogue", "Companion Banter", "Villain Confrontation", "Combat Banter"]} onChange={updateField} />
                <SelectField id="tone" label="Tone" value={form.tone} options={["Natural", "Tense", "Emotional", "Dark", "Humorous", "Epic", "Mysterious"]} onChange={updateField} />
                <SelectField id="length" label="Length" value={form.length} options={["Short", "Standard", "Extended"]} onChange={updateField} />
                <SelectField id="intensity" label="Dramatic intensity" value={form.intensity} options={["Subtle", "Moderate", "High Stakes"]} onChange={updateField} />
              </div>

              <div>
                <label htmlFor="sceneGoal" className="mb-2 block text-sm font-bold text-zinc-300">Scene goal</label>
                <input id="sceneGoal" value={form.sceneGoal} onChange={(event: ChangeEvent<HTMLInputElement>) => updateField("sceneGoal", event.target.value)} placeholder="Example: reveal the betrayal and force the player to choose a side" className="w-full rounded-2xl border border-white/10 bg-[#05040b] p-4 text-white outline-none placeholder:text-zinc-700 focus:border-violet-300/60" />
              </div>

              <div>
                <label htmlFor="specialRequirements" className="mb-2 block text-sm font-bold text-zinc-300">Special requirements</label>
                <textarea id="specialRequirements" value={form.specialRequirements} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateField("specialRequirements", event.target.value)} rows={3} placeholder="Example: include three meaningful choices and one hidden clue" className="w-full resize-y rounded-2xl border border-white/10 bg-[#05040b] p-4 leading-7 text-white outline-none placeholder:text-zinc-700 focus:border-violet-300/60" />
              </div>
            </div>

            {generationError ? <div className="mt-6 rounded-2xl border border-rose-300/20 bg-rose-300/[0.08] p-4 text-sm leading-6 text-rose-100">{generationError}</div> : null}

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button type="submit" disabled={loading} className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 px-6 font-black text-white shadow-[0_16px_48px_rgba(124,58,237,.28)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-65">{loading ? "Generating dialogue..." : "Generate dialogue"}</button>
              <button type="button" onClick={resetTool} disabled={loading} className="h-14 rounded-2xl border border-white/10 bg-white/[0.04] px-6 font-bold text-zinc-300 transition hover:bg-white/[0.08] disabled:opacity-50">Reset</button>
            </div>
          </form>

          <section className="min-h-[760px] rounded-[30px] border border-white/10 bg-gradient-to-br from-blue-950/12 via-[#090711]/92 to-violet-950/22 p-5 shadow-[0_26px_90px_rgba(0,0,0,.46)] backdrop-blur-xl sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-300">Generated result</p>
                <h2 className="mt-2 text-3xl font-black">Dialogue script</h2>
              </div>
              {result ? (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={copyScript} className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-zinc-300 hover:bg-white/[0.06]">{copied ? "Copied" : "Copy"}</button>
                  <button type="button" onClick={() => download("txt")} className="rounded-full border border-violet-300/20 bg-violet-300/10 px-4 py-2 text-sm font-bold text-violet-100">TXT</button>
                  <button type="button" onClick={() => download("json")} className="rounded-full border border-blue-300/20 bg-blue-300/10 px-4 py-2 text-sm font-bold text-blue-100">JSON</button>
                </div>
              ) : null}
            </div>

            {loading ? (
              <div className="flex min-h-[640px] flex-col items-center justify-center text-center">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-violet-400/20 border-t-violet-300" />
                <p className="mt-5 font-black">GameForge is writing the scene...</p>
                <p className="mt-2 text-sm text-zinc-500">{LOADING_STAGES[loadingStage]}</p>
              </div>
            ) : !result ? (
              <div className="mt-7 flex min-h-[640px] flex-col items-center justify-center rounded-[26px] border border-dashed border-white/10 bg-black/15 p-8 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-2xl border border-violet-300/20 bg-violet-300/[0.07] text-3xl">❝</div>
                <p className="mt-5 text-xl font-black">No dialogue generated yet</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">Your result appears only after a successful generation. GameForge does not insert a fake sample or fallback scene.</p>
              </div>
            ) : (
              <div className="mt-7 space-y-5">
                <article className="rounded-2xl border border-violet-300/16 bg-violet-300/[0.06] p-5">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">Scene</p>
                  <h3 className="mt-2 text-2xl font-black">{result.sceneTitle}</h3>
                  <p className="mt-1 text-sm font-bold text-violet-200">{result.sceneSubtitle}</p>
                  <p className="mt-4 leading-7 text-zinc-300">{result.summary}</p>
                </article>

                <article className="rounded-2xl border border-white/10 bg-black/24 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-300">Scene setup</p>
                  <p className="mt-3 leading-7 text-zinc-300">{result.sceneSetup}</p>
                </article>

                <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#05040b]">
                  <div className="border-b border-white/10 px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-fuchsia-300">Script</div>
                  <div className="space-y-3 p-4 sm:p-5">
                    {result.dialogueLines.map((line, index) => (
                      <article key={`${line.speaker}-${index}`} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                        <div className="flex flex-wrap items-baseline gap-3">
                          <span className="font-black uppercase tracking-[0.12em] text-violet-300">{line.speaker}</span>
                          {line.direction ? <span className="text-sm italic text-zinc-500">({line.direction})</span> : null}
                        </div>
                        <p className="mt-2 text-lg leading-8 text-zinc-200">{line.line}</p>
                      </article>
                    ))}
                  </div>
                </section>

                {result.branchingChoices.length ? (
                  <article className="rounded-2xl border border-fuchsia-300/16 bg-fuchsia-300/[0.06] p-5">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-300">Player choices</p>
                    <div className="mt-4 space-y-3">
                      {result.branchingChoices.map((choice, index) => <div key={`${choice}-${index}`} className="rounded-xl border border-white/10 bg-black/25 p-4 leading-7 text-zinc-300"><span className="mr-2 font-black text-fuchsia-300">{index + 1}.</span>{choice}</div>)}
                    </div>
                  </article>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-blue-300">Voice guide</p><div className="mt-3 space-y-2 text-sm leading-6 text-zinc-300">{result.characterVoiceGuide.map((guide, index) => <p key={`${guide}-${index}`}>{guide}</p>)}</div></article>
                  <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">Emotional beats</p><div className="mt-3 space-y-2 text-sm leading-6 text-zinc-300">{result.emotionalBeats.map((beat, index) => <p key={`${beat}-${index}`}><span className="mr-2 font-black text-violet-300">{index + 1}.</span>{beat}</p>)}</div></article>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Subtext and intent</p><p className="mt-3 text-sm leading-7 text-zinc-300">{result.subtextAndIntent}</p></article>
                  <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Performance direction</p><p className="mt-3 text-sm leading-7 text-zinc-300">{result.performanceDirection}</p></article>
                  <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">Continuity</p><p className="mt-3 text-sm leading-7 text-zinc-300">{result.continuityAndConsequences}</p></article>
                  <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-300">Implementation notes</p><p className="mt-3 text-sm leading-7 text-zinc-300">{result.implementationNotes}</p></article>
                </div>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
