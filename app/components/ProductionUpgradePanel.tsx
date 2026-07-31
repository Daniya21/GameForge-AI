"use client";

import { useEffect, useMemo, useState } from "react";

type ServiceStatus = {
  configured: boolean;
  verified?: boolean;
  mode: string;
  note?: string;
  balance?: number;
  frozen?: number;
};

type StatusPayload = {
  services?: {
    groq?: ServiceStatus;
    cloudflare?: ServiceStatus;
    elevenlabs?: ServiceStatus;
    tripo?: ServiceStatus & { model?: string };
  };
};

type Props = {
  title?: string;
  contextTitle: string;
  modelPrompt: string;
  modelRole?: "character" | "environment" | "prop" | "enemy";
  artStyle?: string;
  audioPrompt: string;
  voiceText: string;
  groqContext: {
    role: string;
    summary: string;
    worldContext?: string;
    openingMessage?: string;
  };
};

type ToolState = {
  busy: boolean;
  message: string;
  error: string;
  audioUrl?: string;
  imageUrl?: string;
  generatedPrompt?: string;
};

type TripoToolState = {
  busy: boolean;
  message: string;
  error: string;
  progress: number;
  taskId?: string;
  modelUrl?: string;
  previewUrl?: string;
  consumedCredits?: number;
};

const EMPTY_TOOL: ToolState = { busy: false, message: "", error: "" };
const EMPTY_TRIPO: TripoToolState = { busy: false, message: "", error: "", progress: 0 };

function downloadText(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function studioBrief(contextTitle: string, modelPrompt: string, modelRole: string, artStyle?: string) {
  return [
    "GAMEFORGE → TRIPO STUDIO GENERATION BRIEF",
    "",
    `Project: ${contextTitle}`,
    `Asset role: ${modelRole}`,
    `Art style: Stylized 3D (locked)`,
    "",
    "PROMPT",
    modelPrompt,
    "",
    "WORKFLOW",
    "1. Open Tripo Studio.",
    "2. Use Text-to-3D, or upload the downloaded Cloudflare reference for Image-to-3D.",
    "3. Generate and refine the textured model with your Studio subscription credits.",
    "4. Use retopology / low-poly tools if the mesh is heavy.",
    "5. Export the finished model as GLB (.glb).",
    "6. Build the game, open Playtest, and upload the GLB in the matching 3D Asset Pipeline card.",
    "",
    "TARGET",
    "Keep the subject centered, fully visible, upright, and free of text or logos.",
    "Prefer an embedded-texture GLB below 50 MB for browser playtesting.",
  ].join("\n");
}

export default function ProductionUpgradePanel({
  title = "AI Production Pipeline",
  contextTitle,
  modelPrompt,
  modelRole = "prop",
  artStyle,
  audioPrompt,
  voiceText,
  groqContext,
}: Props) {
  const [status, setStatus] = useState<StatusPayload>({});
  const [visual, setVisual] = useState<ToolState>(EMPTY_TOOL);
  const [tripo, setTripo] = useState<TripoToolState>(EMPTY_TRIPO);
  const [sound, setSound] = useState<ToolState>(EMPTY_TOOL);
  const [voice, setVoice] = useState<ToolState>(EMPTY_TOOL);
  const [assistantMessage, setAssistantMessage] = useState("");
  const [assistantReply, setAssistantReply] = useState(
    groqContext.openingMessage || "Ask Groq to improve, expand, balance, or production-plan this result.",
  );
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/services/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: StatusPayload) => {
        if (active) setStatus(payload);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (sound.audioUrl) URL.revokeObjectURL(sound.audioUrl);
      if (voice.audioUrl) URL.revokeObjectURL(voice.audioUrl);
    };
  }, [sound.audioUrl, voice.audioUrl]);

  const serviceCards = useMemo(
    () => [
      { name: "AI Intelligence", provider: "Groq", status: status.services?.groq },
      { name: "Visual Generation", provider: "Cloudflare Workers AI", status: status.services?.cloudflare },
      { name: "3D Asset Generation", provider: "Tripo", status: status.services?.tripo },
      { name: "Voice & Sound", provider: "ElevenLabs", status: status.services?.elevenlabs },
    ],
    [status],
  );
  const tripoService = status.services?.tripo;
  const tripoCanGenerate = Boolean(
    tripoService?.configured &&
    tripoService?.verified &&
    typeof tripoService.balance === "number" &&
    tripoService.balance > 0,
  );

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1400);
    } catch {
      downloadText(`${contextTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "gameforge"}-${label}.txt`, text);
    }
  }

  async function generateVisual() {
    setVisual({ ...EMPTY_TOOL, busy: true });
    try {
      const response = await fetch("/api/cloudflare/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: modelPrompt, role: modelRole, artStyle }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        imageDataUrl?: string;
        prompt?: string;
        message?: string;
        error?: string;
      };

      if (response.status === 409) {
        setVisual({
          busy: false,
          error: "",
          message: payload.message || "Cloudflare image generation is not configured.",
          generatedPrompt: payload.prompt || modelPrompt,
        });
        return;
      }

      if (!response.ok || !payload.imageDataUrl) {
        throw new Error(payload.error || "Cloudflare could not generate the visual.");
      }

      setVisual({
        busy: false,
        error: "",
        message: "Cloudflare generated a production visual for this result.",
        imageUrl: payload.imageDataUrl,
        generatedPrompt: payload.prompt,
      });
    } catch (error) {
      setVisual({
        busy: false,
        message: "",
        error: error instanceof Error ? error.message : "Cloudflare visual generation failed.",
      });
    }
  }

  async function generate3d() {
    if (tripo.busy) return;
    if (!tripoCanGenerate) {
      setTripo({
        ...EMPTY_TRIPO,
        error: tripoService?.mode === "api-wallet-empty"
          ? "Your Tripo API wallet has 0 credits. The Studio Pro subscription does not include API credits."
          : tripoService?.note || "Tripo is not ready for API generation.",
      });
      return;
    }
    setTripo({ ...EMPTY_TRIPO, busy: true, message: visual.imageUrl ? "Uploading the Cloudflare reference to Tripo…" : "Starting Tripo text-to-3D…" });
    try {
      const role = modelRole === "character" ? "player" : modelRole;
      const response = await fetch("/api/tripo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(visual.imageUrl ? {
          type: "image_to_model",
          imageDataUrl: visual.imageUrl,
          prompt: modelPrompt.slice(0, 1000),
          role,
          faceLimit: role === "environment" ? 9000 : 5000,
          texture: true,
          pbr: true,
        } : {
          type: "text_to_model",
          prompt: modelPrompt.slice(0, 1000),
          role,
          faceLimit: role === "environment" ? 9000 : 5000,
          texture: true,
          pbr: true,
        }),
      });
      const startPayload = await response.json().catch(() => ({})) as { task?: { taskId: string }; error?: string };
      if (!response.ok || !startPayload.task?.taskId) throw new Error(startPayload.error || "Tripo could not start the model task.");

      const taskId = startPayload.task.taskId;
      const started = Date.now();
      while (Date.now() - started < 4 * 60 * 1000) {
        const statusResponse = await fetch(`/api/tripo/status/${encodeURIComponent(taskId)}`, { cache: "no-store" });
        const statusPayload = await statusResponse.json().catch(() => ({})) as {
          task?: { status: string; progress: number; modelUrl?: string; previewUrl?: string; consumedCredits?: number };
          error?: string;
        };
        if (!statusResponse.ok || !statusPayload.task) throw new Error(statusPayload.error || "Tripo task status could not be read.");
        const progress = Math.max(0, Math.min(100, statusPayload.task.progress || 0));
        const normalized = statusPayload.task.status.toLowerCase();
        setTripo((current) => ({ ...current, busy: true, taskId, progress, message: `Generating GLB — ${progress}%` }));
        if (["success", "succeeded", "complete", "completed"].includes(normalized)) {
          if (!statusPayload.task.modelUrl) throw new Error("Tripo completed without returning a playable GLB.");
          setTripo({
            busy: false,
            error: "",
            message: "Tripo generated the GLB. The model is served securely through GameForge.",
            progress: 100,
            taskId,
            modelUrl: statusPayload.task.modelUrl,
            previewUrl: statusPayload.task.previewUrl,
            consumedCredits: statusPayload.task.consumedCredits,
          });
          return;
        }
        if (["failed", "failure", "banned", "cancelled", "canceled", "error"].includes(normalized)) {
          throw new Error("Tripo could not generate this model.");
        }
        await new Promise((resolve) => window.setTimeout(resolve, 4500));
      }
      throw new Error("Tripo is still processing this task. Keep the task ID and check it again from Playtest.");
    } catch (error) {
      setTripo((current) => ({ ...current, busy: false, error: error instanceof Error ? error.message : "Tripo generation failed.", message: "" }));
    }
  }

  async function generateAudio(kind: "sound" | "voice") {
    const setter = kind === "sound" ? setSound : setVoice;
    const previous = kind === "sound" ? sound.audioUrl : voice.audioUrl;
    setter({ ...EMPTY_TOOL, busy: true });
    try {
      const response = await fetch(kind === "sound" ? "/api/elevenlabs/sfx" : "/api/elevenlabs/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          kind === "sound"
            ? { prompt: audioPrompt, durationSeconds: 6, loop: true }
            : { text: voiceText },
        ),
      });
      const contentType = response.headers.get("Content-Type") || "";
      if (response.ok && contentType.startsWith("audio/")) {
        if (previous) URL.revokeObjectURL(previous);
        const url = URL.createObjectURL(await response.blob());
        setter({
          busy: false,
          error: "",
          message: `${kind === "sound" ? "Sound" : "Voice"} generated successfully.`,
          audioUrl: url,
        });
        const player = new Audio(url);
        void player.play().catch(() => undefined);
        return;
      }
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      if (response.status === 409) {
        if (kind === "voice" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(new SpeechSynthesisUtterance(voiceText.slice(0, 800)));
        }
        setter({ busy: false, error: "", message: payload.message || "Browser audio fallback used." });
        return;
      }
      throw new Error(payload.error || "Audio generation failed.");
    } catch (error) {
      setter({
        busy: false,
        message: "",
        error: error instanceof Error ? error.message : "Audio generation failed.",
      });
    }
  }

  async function askGroq() {
    if (assistantMessage.trim().length < 2 || assistantBusy) return;
    setAssistantBusy(true);
    try {
      const response = await fetch("/api/groq/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contextTitle,
          role: groqContext.role,
          summary: groqContext.summary,
          worldContext: groqContext.worldContext,
          message: assistantMessage.trim(),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        reply?: string;
        error?: string;
      };
      if (!response.ok || !payload.reply) {
        throw new Error(payload.error || "Groq did not return a response.");
      }
      setAssistantReply(payload.reply);
      setAssistantMessage("");
    } catch (error) {
      setAssistantReply(error instanceof Error ? error.message : "Groq did not return a response.");
    } finally {
      setAssistantBusy(false);
    }
  }

  return (
    <section className="rounded-[30px] border border-cyan-400/15 bg-[linear-gradient(145deg,rgba(34,211,238,.055),rgba(139,92,246,.045))] p-5 shadow-2xl shadow-black/25 sm:p-7">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Four-Service Creation Layer</p>
        <h2 className="mt-2 text-2xl font-black sm:text-3xl">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
          Use Groq to plan the build, Cloudflare Workers AI to create visual references, Tripo Studio or the Tripo API to create signature GLB models, and ElevenLabs to create voice and sound for <span className="font-bold text-zinc-200">{contextTitle}</span>.
        </p>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {serviceCards.map((item) => (
          <div key={item.name} className="rounded-2xl border border-white/8 bg-black/25 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{item.name}</p>
              <span className={`h-2.5 w-2.5 rounded-full ${item.status?.configured && !["configured-unverified", "api-wallet-empty"].includes(item.status?.mode || "") ? "bg-green-400 shadow-[0_0_14px_rgba(74,222,128,.8)]" : "bg-amber-300"}`} />
            </div>
            <p className="mt-2 text-sm font-black text-zinc-200">{item.provider}</p>
            <p className="mt-1 truncate text-xs text-zinc-500">{item.status?.mode || "Checking…"}</p>
            {item.provider === "Tripo" && typeof item.status?.balance === "number" && (
              <p className={`mt-2 text-xs font-black ${item.status.balance > 0 ? "text-emerald-300" : "text-amber-300"}`}>{item.status.balance} API credits available</p>
            )}
            {item.status?.note && <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-zinc-600">{item.status.note}</p>}
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        <article className="rounded-[24px] border border-cyan-400/15 bg-cyan-400/[0.04] p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Groq Intelligence</p>
          <h3 className="mt-2 text-xl font-black">Improve this result</h3>
          <div className="mt-3 min-h-28 rounded-xl border border-white/8 bg-black/25 p-4 text-sm leading-6 text-zinc-300">{assistantReply}</div>
          <div className="mt-3 flex gap-2">
            <input
              value={assistantMessage}
              onChange={(event) => setAssistantMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void askGroq();
              }}
              placeholder="Ask for an improvement…"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-cyan-300/40"
            />
            <button
              type="button"
              onClick={askGroq}
              disabled={assistantBusy || assistantMessage.trim().length < 2}
              className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-black text-cyan-950 disabled:opacity-50"
            >
              {assistantBusy ? "…" : "Ask"}
            </button>
          </div>
        </article>

        <article className="rounded-[24px] border border-violet-400/15 bg-violet-400/[0.045] p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">Cloudflare Visual AI</p>
          <h3 className="mt-2 text-xl font-black">Generate concept artwork</h3>
          <p className="mt-2 line-clamp-4 text-sm leading-6 text-zinc-400">{modelPrompt}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={generateVisual}
              disabled={visual.busy}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-black disabled:opacity-50"
            >
              {visual.busy ? "Generating…" : "Generate with Cloudflare"}
            </button>
            <button
              type="button"
              onClick={() => copyText("visual", visual.generatedPrompt || modelPrompt)}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-black"
            >
              {copied === "visual" ? "Copied" : "Copy Prompt"}
            </button>
          </div>
          {visual.message && <p className="mt-3 text-xs leading-5 text-cyan-200">{visual.message}</p>}
          {visual.error && <p className="mt-3 text-xs leading-5 text-red-300">{visual.error}</p>}
          {visual.imageUrl && (
            <>
              <img
                src={visual.imageUrl}
                alt="Cloudflare generated game visual"
                className="mt-4 aspect-video w-full rounded-xl border border-white/10 bg-black/30 object-cover"
              />
              <a
                href={visual.imageUrl}
                download={`${contextTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "gameforge"}-visual.jpg`}
                className="mt-3 inline-flex text-sm font-black text-green-300 underline underline-offset-4"
              >
                Download generated artwork
              </a>
            </>
          )}
          <p className="mt-3 text-[11px] leading-5 text-zinc-500">
            Cloudflare generates 2D avatars and concept art. Tripo converts selected hero references or prompts into GLB models, while PlayCanvas assembles the playable scene with safe fallback assets.
          </p>
        </article>

        <article className="rounded-[24px] border border-emerald-400/15 bg-emerald-400/[0.04] p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Tripo 3D</p>
          <h3 className="mt-2 text-xl font-black">API or Studio credits</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            {visual.imageUrl ? "Use the Cloudflare visual as an Image-to-3D reference in Tripo Studio, or use the API when its separate wallet has credits." : "Use the prepared production prompt in Tripo Studio with your subscription credits, or use the API when its separate wallet has credits."}
          </p>

          <div className="mt-4 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.055] p-3">
            <p className="text-xs font-black text-emerald-200">Use your Tripo Studio subscription now</p>
            <p className="mt-1 text-xs leading-5 text-emerald-50/70">Copy or download the brief, generate the asset in Studio, export it as GLB, then import that GLB from the Playtest 3D Asset Pipeline.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => copyText("studio-prompt", modelPrompt)} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs font-black">
                {copied === "studio-prompt" ? "Prompt copied" : "Copy Studio prompt"}
              </button>
              <button type="button" onClick={() => downloadText(`${contextTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "gameforge"}-tripo-studio-brief.txt`, studioBrief(contextTitle, modelPrompt, modelRole, artStyle))} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs font-black">
                Download brief
              </button>
              <a href="https://studio.tripo3d.ai" target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-100">Open Tripo Studio</a>
            </div>
            {visual.imageUrl && <p className="mt-2 text-[11px] leading-5 text-zinc-500">Download the Cloudflare artwork from the Visual AI card and upload it to Studio for Image-to-3D.</p>}
          </div>

          <div className="mt-4 border-t border-white/8 pt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Optional automatic API generation</p>
            <button
              type="button"
              onClick={generate3d}
              disabled={tripo.busy || !tripoCanGenerate}
              className="mt-3 w-full rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-2.5 text-sm font-black text-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {tripo.busy ? `Generating ${tripo.progress}%` : tripoService?.mode === "api-wallet-empty" ? "API wallet empty — use Studio above" : "Generate with Tripo API"}
            </button>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full rounded-full bg-emerald-300 transition-all" style={{ width: `${tripo.progress}%` }} />
            </div>
          </div>
          {tripo.previewUrl && <img src={tripo.previewUrl} alt="Tripo generated 3D model preview" className="mt-4 aspect-video w-full rounded-xl border border-white/10 bg-black/30 object-cover" />}
          {tripo.modelUrl && (
            <a href={tripo.modelUrl} className="mt-3 inline-flex text-sm font-black text-emerald-300 underline underline-offset-4">Open generated GLB</a>
          )}
          {typeof tripo.consumedCredits === "number" && <p className="mt-2 text-xs font-bold text-amber-200">Consumed {tripo.consumedCredits} API credits</p>}
          {tripo.taskId && <p className="mt-2 break-all text-[10px] text-zinc-600">Task: {tripo.taskId}</p>}
          {tripo.message && <p className="mt-3 text-xs leading-5 text-emerald-200">{tripo.message}</p>}
          {tripo.error && <p className="mt-3 text-xs leading-5 text-red-300">{tripo.error}</p>}
          {!tripoService?.configured && <p className="mt-3 text-xs text-amber-200">The API key is optional for the Studio workflow. Add TRIPO_API_KEY only for automatic API generation.</p>}
        </article>

        <article className="rounded-[24px] border border-amber-400/15 bg-amber-400/[0.04] p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">ElevenLabs Audio</p>
          <h3 className="mt-2 text-xl font-black">Generate voice and sound</h3>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-400">{audioPrompt}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => generateAudio("sound")}
              disabled={sound.busy}
              className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2.5 text-sm font-black text-amber-100 disabled:opacity-50"
            >
              {sound.busy ? "Creating…" : "Create SFX"}
            </button>
            <button
              type="button"
              onClick={() => generateAudio("voice")}
              disabled={voice.busy}
              className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2.5 text-sm font-black text-cyan-100 disabled:opacity-50"
            >
              {voice.busy ? "Speaking…" : "Voice Line"}
            </button>
          </div>
          {sound.audioUrl && <audio className="mt-3 w-full" controls src={sound.audioUrl} />}
          {voice.audioUrl && <audio className="mt-3 w-full" controls src={voice.audioUrl} />}
          {(sound.message || voice.message) && <p className="mt-3 text-xs leading-5 text-zinc-400">{sound.message || voice.message}</p>}
          {(sound.error || voice.error) && <p className="mt-3 text-xs leading-5 text-red-300">{sound.error || voice.error}</p>}
        </article>
      </div>
    </section>
  );
}
