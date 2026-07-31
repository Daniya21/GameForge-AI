"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import type { DesignStudioSectionName } from "@/app/types/game-project";
import { saveDesignStudioSection } from "@/lib/game-project/client";

type Field = {
  name: string;
  label: string;
  placeholder: string;
  type?: "text" | "textarea" | "select";
  options?: string[];
};

type ResultSection =
  | string
  | {
      title: string;
      content: string;
    };

type FeatureConfig = {
  title: string;
  eyebrow: string;
  description: string;
  image: string;
  accent: string;
  fields: Field[];
  button: string;
  resultTitle: string;
  buildResult?: (values: Record<string, string>) => ResultSection[];
  generateResult?: (values: Record<string, string>) => Promise<ResultSection[]>;
  projectSection?: DesignStudioSectionName;
};

export default function FeatureTool({ config }: { config: FeatureConfig }) {
  const initialValues = useMemo(
    () => Object.fromEntries(config.fields.map((field) => [field.name, ""])),
    [config.fields],
  );
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ResultSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generationError, setGenerationError] = useState("");

  function updateValue(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    config.fields.forEach((field) => {
      if (!values[field.name]?.trim()) nextErrors[field.name] = `${field.label} is required.`;
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    setResult([]);
    setCopied(false);
    setGenerationError("");

    try {
      let generated: ResultSection[];
      if (config.generateResult) {
        generated = await config.generateResult(values);
      } else if (config.buildResult) {
        await new Promise((resolve) => setTimeout(resolve, 850));
        generated = config.buildResult(values);
      } else {
        throw new Error("This GameForge module has not been connected to a generator yet.");
      }
      setResult(generated);
      if (config.projectSection) {
        saveDesignStudioSection(config.projectSection, values, {
          title: config.resultTitle,
          sections: generated,
        });
      }
    } catch (error) {
      setGenerationError(
        error instanceof Error && error.message
          ? error.message
          : "The result could not be generated. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function resetTool() {
    setValues(initialValues);
    setErrors({});
    setResult([]);
    setCopied(false);
    setGenerationError("");
  }

  function resultAsText() {
    return result
      .map((item) => (typeof item === "string" ? item : `${item.title}\n${item.content}`))
      .join("\n\n");
  }

  async function copyResult() {
    if (!result.length) return;
    await navigator.clipboard.writeText(`${config.resultTitle}\n\n${resultAsText()}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function downloadResult() {
    if (!result.length) return;
    const blob = new Blob([`${config.resultTitle}\n\n${resultAsText()}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${config.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(168,85,247,.18),transparent_34%),radial-gradient(circle_at_80%_25%,rgba(34,211,238,.14),transparent_30%),linear-gradient(135deg,#070312,#020714_55%,#05020b)]" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:64px_64px]" />
      </div>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-20 pt-28 sm:px-8 sm:pt-32">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-zinc-500">
            <Link href="/design-studio" className="rounded-xl px-3 py-2 transition hover:bg-white/[0.06] hover:text-white">Design Studio</Link>
            <span>/</span>
            <span className="px-2 text-zinc-300">{config.title}</span>
          </div>
          <Link href="/projects" className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-2 text-xs font-black text-cyan-100">Open Project Library</Link>
        </div>
        <section className="grid items-center gap-8 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.32em] text-cyan-300">{config.eyebrow}</p>
            <h1 className="mt-4 text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">{config.title}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">{config.description}</p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm text-zinc-300">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">Connected AI agent</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">Saved to active project</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">Presentation-ready output</span>
            </div>
          </div>
          <div className="relative h-[330px] overflow-hidden rounded-[30px] border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,.6)] sm:h-[420px]">
            <Image
  src={config.image}
  alt={config.title}
  fill
  priority
  className="object-contain p-4"
/>
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
            <div className="absolute inset-x-6 bottom-6 rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-lg">
              <div className="text-sm font-bold text-white">Specialist GameForge agent</div>
              <div className="mt-1 text-xs text-zinc-300">Saved directly into the active project with the other Design Studio results.</div>
            </div>
          </div>
        </section>

        <section className="mt-12 grid items-start gap-8 lg:grid-cols-[1fr_1fr]">
          <form onSubmit={handleSubmit} className="rounded-[30px] border border-white/10 bg-white/[0.035] p-5 shadow-[0_26px_90px_rgba(0,0,0,.5)] backdrop-blur-xl sm:p-8">
            <div className="mb-7">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-fuchsia-300">Creative input</p>
              <h2 className="mt-2 text-3xl font-black">Brief the specialist agent</h2>
            </div>

            <div className="space-y-5">
              {config.fields.map((field) => (
                <div key={field.name}>
                  <label htmlFor={field.name} className="mb-2 block text-sm font-bold text-zinc-200">{field.label}</label>
                  {field.type === "textarea" ? (
                    <textarea id={field.name} value={values[field.name]} onChange={(e) => updateValue(field.name, e.target.value)} placeholder={field.placeholder} className={`min-h-36 w-full resize-y rounded-2xl border bg-black/35 p-4 text-white outline-none transition placeholder:text-zinc-600 ${errors[field.name] ? "border-red-500" : "border-white/10 focus:border-cyan-400/60 focus:shadow-[0_0_26px_rgba(34,211,238,.1)]"}`} />
                  ) : field.type === "select" ? (
                    <select id={field.name} value={values[field.name]} onChange={(e) => updateValue(field.name, e.target.value)} className={`w-full rounded-2xl border bg-zinc-950 p-4 text-white outline-none transition ${errors[field.name] ? "border-red-500" : "border-white/10 focus:border-cyan-400/60"}`}>
                      <option value="">Select an option</option>
                      {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : (
                    <input id={field.name} value={values[field.name]} onChange={(e) => updateValue(field.name, e.target.value)} placeholder={field.placeholder} className={`w-full rounded-2xl border bg-black/35 p-4 text-white outline-none transition placeholder:text-zinc-600 ${errors[field.name] ? "border-red-500" : "border-white/10 focus:border-cyan-400/60"}`} />
                  )}
                  {errors[field.name] && <p className="mt-2 text-sm text-red-400">{errors[field.name]}</p>}
                </div>
              ))}
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button type="submit" disabled={loading} className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-cyan-500 px-6 font-black text-white shadow-[0_14px_45px_rgba(139,92,246,.28)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70">
                {loading ? "Generating..." : config.button}
              </button>
              <button type="button" onClick={resetTool} className="h-14 rounded-2xl border border-white/10 bg-white/[0.04] px-6 font-bold text-zinc-300 transition hover:bg-white/[0.08]">Reset</button>
            </div>
          </form>

          <div className="min-h-[520px] rounded-[30px] border border-white/10 bg-gradient-to-br from-cyan-950/15 via-zinc-950/85 to-violet-950/25 p-5 shadow-[0_26px_90px_rgba(0,0,0,.5)] backdrop-blur-xl sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">Generated result</p>
                <h2 className="mt-2 text-3xl font-black">{config.resultTitle}</h2>
              </div>
              {result.length > 0 && (
                <div className="flex gap-2">
                  <button onClick={copyResult} className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-zinc-300 hover:bg-white/[0.06]">{copied ? "Copied" : "Copy"}</button>
                  <button onClick={downloadResult} className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200 hover:bg-cyan-400/15">Download</button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex min-h-[380px] flex-col items-center justify-center text-center">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-violet-500/20 border-t-cyan-300" />
                <p className="mt-5 font-bold text-zinc-200">GameForge AI is creating your result...</p>
                <p className="mt-2 text-sm text-zinc-500">Shaping structure, detail, and creative direction.</p>
              </div>
            ) : generationError ? (
              <div
                aria-live="polite"
                className="mt-7 rounded-3xl border border-red-400/20 bg-red-500/[0.08] p-6 text-left"
              >
                <p className="font-black text-red-200">Generation stopped</p>
                <p className="mt-2 leading-7 text-red-100/80">{generationError}</p>
              </div>
            ) : result.length === 0 ? (
              <div className="flex min-h-[380px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/15 p-8 text-center">
                <div className="text-5xl">✦</div>
                <p className="mt-5 text-xl font-black">Your result will appear here</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">Complete the focused form and generate a polished concept without leaving this page.</p>
              </div>
            ) : (
              <div className="mt-7 space-y-4">
                {result.map((item, index) => {
                  const sectionTitle = typeof item === "string" ? `Section ${index + 1}` : item.title;
                  const sectionContent = typeof item === "string" ? item : item.content;

                  return (
                    <article
                      key={`${sectionTitle}-${index}`}
                      className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-left"
                    >
                      <div
                        className="mb-2 text-xs font-black uppercase tracking-[0.2em]"
                        style={{ color: config.accent }}
                      >
                        {sectionTitle}
                      </div>
                      <p className="whitespace-pre-line leading-7 text-zinc-300">{sectionContent}</p>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {result.length > 0 && (
          <div className="mt-8">
            
          </div>
        )}
      </main>
    </div>
  );
}
