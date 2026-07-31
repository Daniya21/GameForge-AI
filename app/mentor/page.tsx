"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { saveDesignStudioSection } from "@/lib/game-project/client";

type FormState = {
  challenge: string;
  projectStage: string;
  mainPriority: string;
  gameContext: string;
  constraints: string;
  feedbackStyle: string;
};

type ResultSection = {
  title: string;
  content: string;
};

type MentorResult = {
  reviewTitle: string;
  oneLineVerdict: string;
  sections: ResultSection[];
};

type FollowUpResult = {
  question: string;
  answer: string;
  recommendedActions: string[];
  tradeoffToWatch: string;
};

const INITIAL_FORM: FormState = {
  challenge: "",
  projectStage: "Prototype",
  mainPriority: "Fun & Core Loop",
  gameContext: "",
  constraints: "",
  feedbackStyle: "Direct and Practical",
};

const EXAMPLES = [
  "My combat feels exciting for five minutes but becomes repetitive because the player keeps using the same safest attack.",
  "Our game idea has too many systems for a three-person team, but we do not know what to cut without losing the identity.",
  "Players understand the mechanics, but they do not care about the story choices because every outcome feels similar.",
];

const LOADING_STAGES = [
  "Understanding the real design problem",
  "Separating symptoms from root causes",
  "Building a practical action plan",
  "Designing the smallest useful test",
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
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(id, event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-zinc-950 p-4 text-white outline-none transition focus:border-violet-400/60 focus:shadow-[0_0_24px_rgba(167,139,250,.12)]"
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

export default function MentorPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [result, setResult] = useState<MentorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [generationError, setGenerationError] = useState("");
  const [copied, setCopied] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const [followUps, setFollowUps] = useState<FollowUpResult[]>([]);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpError, setFollowUpError] = useState("");

  useEffect(() => {
    if (!loading) return;

    const timer = window.setInterval(() => {
      setLoadingStage((current) =>
        current < LOADING_STAGES.length - 1 ? current + 1 : current,
      );
    }, 1900);

    return () => window.clearInterval(timer);
  }, [loading]);

  const reviewText = useMemo(() => {
    if (!result) return "";

    const followUpText = followUps.flatMap((item, index) => [
      `Follow-up ${index + 1}: ${item.question}`,
      item.answer,
      `Recommended actions\n${item.recommendedActions.map((action, actionIndex) => `${actionIndex + 1}. ${action}`).join("\n")}`,
      `Trade-off to watch\n${item.tradeoffToWatch}`,
    ]);

    return [
      result.reviewTitle,
      result.oneLineVerdict,
      ...result.sections.map((section) => `${section.title}\n${section.content}`),
      ...followUpText,
    ].join("\n\n");
  }, [result, followUps]);

  function updateField(name: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  function applyExample(example: string) {
    setForm((current) => ({ ...current, challenge: example }));
    setErrors((current) => ({ ...current, challenge: "" }));
  }

  function validate() {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};

    if (form.challenge.trim().length < 12) {
      nextErrors.challenge = "Describe the game-design challenge in at least 12 characters.";
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
    setFollowUps([]);
    setFollowUpQuestion("");
    setFollowUpError("");

    try {
      const response = await fetch("/api/mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "review", ...form }),
      });

      const payload = (await response.json().catch(() => ({}))) as Partial<MentorResult> & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "The AI Mentor could not generate a review.");
      }

      if (!payload.sections?.length || !payload.reviewTitle) {
        throw new Error("The AI Mentor returned an incomplete review.");
      }

      setResult(payload as MentorResult);
      saveDesignStudioSection("mentor", form, payload as MentorResult);
    } catch (error) {
      setGenerationError(
        error instanceof Error && error.message
          ? error.message
          : "The mentor review could not be generated. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function askFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!result || followUpQuestion.trim().length < 4) {
      setFollowUpError("Write a clear follow-up question.");
      return;
    }

    const question = followUpQuestion.trim();
    setFollowUpLoading(true);
    setFollowUpError("");

    try {
      const response = await fetch("/api/mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "followup",
          ...form,
          previousReview: reviewText,
          followUpQuestion: question,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as Partial<
        Omit<FollowUpResult, "question">
      > & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "The AI Mentor could not answer the follow-up.");
      }

      if (!payload.answer || !payload.recommendedActions?.length || !payload.tradeoffToWatch) {
        throw new Error("The AI Mentor returned an incomplete follow-up answer.");
      }

      setFollowUps((current) => [
        ...current,
        {
          question,
          answer: payload.answer as string,
          recommendedActions: payload.recommendedActions as string[],
          tradeoffToWatch: payload.tradeoffToWatch as string,
        },
      ]);
      setFollowUpQuestion("");
    } catch (error) {
      setFollowUpError(
        error instanceof Error && error.message
          ? error.message
          : "The follow-up could not be answered. Please try again.",
      );
    } finally {
      setFollowUpLoading(false);
    }
  }

  function resetTool() {
    setForm(INITIAL_FORM);
    setErrors({});
    setResult(null);
    setGenerationError("");
    setCopied(false);
    setLoadingStage(0);
    setFollowUps([]);
    setFollowUpQuestion("");
    setFollowUpError("");
  }

  async function copyReview() {
    if (!reviewText) return;
    await navigator.clipboard.writeText(reviewText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function downloadReview() {
    if (!reviewText || !result) return;
    const blob = new Blob([reviewText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${result.reviewTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-mentor-review.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(139,92,246,.18),transparent_34%),radial-gradient(circle_at_82%_24%,rgba(34,211,238,.10),transparent_30%),linear-gradient(135deg,#090414,#040712_56%,#07030d)]" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:64px_64px]" />
      </div>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-20 pt-28 sm:px-8 sm:pt-32">
        <section className="grid items-center gap-8 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.32em] text-violet-300">
              Game design review + practical coaching
            </p>
            <h1 className="mt-4 text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              AI Mentor
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
              Explain any game-development problem in normal language. GameForge AI will diagnose
              the issue, challenge weak assumptions, control scope, and give you a prioritized plan
              you can actually test.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm text-zinc-300">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
                Prompt-aware diagnosis
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
                Actionable next steps
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
                Follow-up mentoring
              </span>
            </div>
          </div>

          <div className="group relative h-[330px] overflow-hidden rounded-[30px] border border-white/10 bg-black/25 shadow-[0_30px_100px_rgba(0,0,0,.6)] sm:h-[420px]">
            <Image
              src="/cards/ai-mentor.png"
              alt="GameForge AI Mentor"
              fill
              priority
              className="object-contain p-4 transition duration-700 group-hover:scale-[1.025]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
            <div className="absolute inset-x-6 bottom-6 rounded-2xl border border-violet-300/15 bg-black/40 p-4 backdrop-blur-lg">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-300 opacity-70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-violet-300" />
                </span>
                Senior design mentor online
              </div>
              <div className="mt-1 text-xs text-zinc-300">
                Design, scope, UX, production, testing, and presentation guidance.
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-4 rounded-[30px] border border-white/10 bg-white/[0.035] p-5 shadow-[0_20px_70px_rgba(0,0,0,.35)] backdrop-blur-xl sm:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-violet-300">Example challenges</p>
            <h2 className="mt-2 text-2xl font-black">The mentor can review almost any game problem</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => applyExample(example)}
                className="rounded-2xl border border-white/10 bg-black/25 p-4 text-left text-sm leading-6 text-zinc-300 transition hover:border-violet-400/40 hover:bg-white/[0.045]"
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
              <p className="text-xs font-black uppercase tracking-[0.25em] text-violet-300">Project context</p>
              <h2 className="mt-2 text-3xl font-black">What do you need help with?</h2>
            </div>

            <div className="space-y-5">
              <div>
                <label htmlFor="challenge" className="mb-2 block text-sm font-bold text-zinc-200">
                  Design challenge or question
                </label>
                <textarea
                  id="challenge"
                  value={form.challenge}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateField("challenge", event.target.value)}
                  placeholder="Describe what is not working, what decision you are stuck on, or what you need reviewed..."
                  className={`min-h-40 w-full resize-y rounded-2xl border bg-black/35 p-4 text-white outline-none transition placeholder:text-zinc-600 ${errors.challenge ? "border-red-500" : "border-white/10 focus:border-violet-400/60 focus:shadow-[0_0_26px_rgba(139,92,246,.1)]"}`}
                />
                {errors.challenge && <p className="mt-2 text-sm text-red-400">{errors.challenge}</p>}
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <SelectField
                  id="projectStage"
                  label="Project stage"
                  value={form.projectStage}
                  options={["Idea", "Prototype", "Vertical Slice", "Production", "Polish", "Launch / Live Game"]}
                  onChange={updateField}
                />
                <SelectField
                  id="mainPriority"
                  label="Main priority"
                  value={form.mainPriority}
                  options={["Fun & Core Loop", "Scope & Feasibility", "Story & World", "Retention & Progression", "Accessibility & Clarity", "Presentation & Pitch", "Technical Direction"]}
                  onChange={updateField}
                />
              </div>

              <div>
                <label htmlFor="gameContext" className="mb-2 block text-sm font-bold text-zinc-200">
                  Game context (optional)
                </label>
                <textarea
                  id="gameContext"
                  value={form.gameContext}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateField("gameContext", event.target.value)}
                  placeholder="Genre, platform, audience, core mechanic, current design, or any details the mentor should understand."
                  className="min-h-28 w-full resize-y rounded-2xl border border-white/10 bg-black/35 p-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-400/60"
                />
              </div>

              <div>
                <label htmlFor="constraints" className="mb-2 block text-sm font-bold text-zinc-200">
                  Team and constraints (optional)
                </label>
                <textarea
                  id="constraints"
                  value={form.constraints}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateField("constraints", event.target.value)}
                  placeholder="Team size, deadline, budget, engine, skill level, technical limits, or features that cannot change."
                  className="min-h-24 w-full resize-y rounded-2xl border border-white/10 bg-black/35 p-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-400/60"
                />
              </div>

              <SelectField
                id="feedbackStyle"
                label="Mentor style"
                value={form.feedbackStyle}
                options={["Direct and Practical", "Supportive Coach", "Detailed Design Review", "Producer-Focused"]}
                onChange={updateField}
              />
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={loading}
                className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 px-6 font-black text-white shadow-[0_14px_45px_rgba(139,92,246,.28)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70"
              >
                {loading ? "Reviewing..." : "Get Mentor Review"}
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

          <div className="rounded-[30px] border border-white/10 bg-gradient-to-br from-violet-950/20 via-zinc-950/85 to-cyan-950/15 p-5 shadow-[0_26px_90px_rgba(0,0,0,.5)] backdrop-blur-xl sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-violet-300">Mentor output</p>
                <h2 className="mt-2 text-3xl font-black">Design Review</h2>
              </div>
              {result && (
                <div className="flex gap-2">
                  <button
                    onClick={copyReview}
                    className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-zinc-300 hover:bg-white/[0.06]"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={downloadReview}
                    className="rounded-full border border-violet-400/20 bg-violet-400/10 px-4 py-2 text-sm font-bold text-violet-200 hover:bg-violet-400/15"
                  >
                    Download
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-violet-500/20 border-t-violet-300" />
                <p className="mt-5 font-bold text-zinc-200">GameForge AI is reviewing your project...</p>
                <p className="mt-2 text-sm text-zinc-500">{LOADING_STAGES[loadingStage]}</p>
              </div>
            ) : generationError ? (
              <div
                aria-live="polite"
                className="mt-7 rounded-3xl border border-red-400/20 bg-red-500/[0.08] p-6 text-left"
              >
                <p className="font-black text-red-200">Mentor review stopped</p>
                <p className="mt-2 leading-7 text-red-100/80">{generationError}</p>
              </div>
            ) : !result ? (
              <div className="flex min-h-[520px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/15 p-8 text-center">
                <div className="text-5xl">✦</div>
                <p className="mt-5 text-xl font-black">Your mentor review will appear here</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
                  Share the real problem, project stage, and constraints. The mentor will give you a
                  focused diagnosis instead of generic advice.
                </p>
              </div>
            ) : (
              <div className="mt-7 space-y-6">
                <article className="rounded-2xl border border-violet-400/15 bg-violet-400/[0.06] p-5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">Mentor verdict</p>
                  <h3 className="mt-2 text-2xl font-black text-white">{result.reviewTitle}</h3>
                  <p className="mt-3 leading-7 text-zinc-300">{result.oneLineVerdict}</p>
                </article>

                <div className="space-y-4">
                  {result.sections.map((section) => (
                    <article
                      key={section.title}
                      className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-left"
                    >
                      <div className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-violet-300">
                        {section.title}
                      </div>
                      <p className="whitespace-pre-line leading-7 text-zinc-300">{section.content}</p>
                    </article>
                  ))}
                </div>

                {followUps.map((followUp, index) => (
                  <section
                    key={`${followUp.question}-${index}`}
                    className="space-y-4 rounded-[24px] border border-cyan-400/15 bg-cyan-400/[0.035] p-5"
                  >
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                        Your follow-up
                      </p>
                      <p className="mt-2 font-bold text-white">{followUp.question}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
                        Mentor answer
                      </p>
                      <p className="mt-2 leading-7 text-zinc-300">{followUp.answer}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
                        Recommended actions
                      </p>
                      <p className="mt-2 whitespace-pre-line leading-7 text-zinc-300">
                        {followUp.recommendedActions
                          .map((action, actionIndex) => `${actionIndex + 1}. ${action}`)
                          .join("\n")}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] p-4">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-200">
                        Trade-off to watch
                      </p>
                      <p className="mt-2 leading-7 text-zinc-300">{followUp.tradeoffToWatch}</p>
                    </div>
                  </section>
                ))}

                <form
                  onSubmit={askFollowUp}
                  className="rounded-[24px] border border-violet-400/15 bg-black/20 p-5"
                >
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
                    Continue the consultation
                  </p>
                  <h3 className="mt-2 text-xl font-black">Ask a follow-up question</h3>
                  <textarea
                    value={followUpQuestion}
                    onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                      setFollowUpQuestion(event.target.value);
                      setFollowUpError("");
                    }}
                    placeholder="For example: Which feature should we cut first, and how can we test whether that decision was correct?"
                    className="mt-4 min-h-24 w-full resize-y rounded-2xl border border-white/10 bg-black/35 p-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-400/60"
                  />
                  {followUpError && <p className="mt-2 text-sm text-red-400">{followUpError}</p>}
                  <button
                    type="submit"
                    disabled={followUpLoading}
                    className="mt-4 h-12 rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 font-black text-white transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70"
                  >
                    {followUpLoading ? "Mentor is answering..." : "Ask Mentor"}
                  </button>
                </form>
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
