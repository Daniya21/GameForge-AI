"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameBuildSpec } from "@/app/types/game";
import {
  deleteLocalModel,
  isLocalModelUrl,
  localModelUrl,
  saveLocalGlb,
} from "@/lib/game-assets/local-model-store";
import {
  GAME_PROJECT_EVENT,
  resolveProjectReferenceImages,
  readActiveGameProject,
  type ProjectReferenceImage,
} from "@/lib/game-project/client";

type Props = {
  spec: GameBuildSpec;
  onSpecChange: (spec: GameBuildSpec) => void;
};

type GeneratedAsset = NonNullable<GameBuildSpec["assets"]["generatedModels"]>[number];

type JobState = {
  taskId?: string;
  status: "idle" | "starting" | "queued" | "running" | "ready" | "failed";
  progress: number;
  error: string;
};

type StatusPayload = {
  task?: {
    taskId: string;
    status: string;
    progress: number;
    modelUrl?: string;
    previewUrl?: string;
    consumedCredits?: number;
  };
  error?: string;
};

type TripoAvailability = {
  checked: boolean;
  ready: boolean;
  mode: string;
  balance?: number;
  note: string;
};

function normalizedStatus(value: string): JobState["status"] {
  const status = value.toLowerCase();
  if (["success", "succeeded", "completed", "complete", "finished"].includes(status)) return "ready";
  if (["failed", "failure", "cancelled", "canceled", "error"].includes(status)) return "failed";
  if (["queued", "pending", "waiting"].includes(status)) return "queued";
  return "running";
}

function formatBytes(bytes?: number) {
  if (!bytes || bytes < 1) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes > 20 * 1024 * 1024 ? 0 : 1)} MB`;
}

function studioBrief(spec: GameBuildSpec, asset: GeneratedAsset, reference?: ProjectReferenceImage) {
  return [
    "GAMEFORGE → TRIPO STUDIO ASSET BRIEF",
    "",
    `Game: ${spec.title}`,
    `Template: ${spec.templateFamily.replaceAll("-", " ")}`,
    `Asset role: ${asset.role}`,
    `Art direction: ${spec.artStyle}`,
    "",
    "PROMPT",
    asset.prompt,
    "",
    reference ? `DESIGN STUDIO REFERENCE: ${reference.name}` : "DESIGN STUDIO REFERENCE: none — use the text prompt",
    "",
    "RECOMMENDED STUDIO WORKFLOW",
    reference
      ? "1. Download the Cloudflare reference image from this GameForge asset card, then open Tripo Studio and choose Image-to-3D."
      : "1. Open Tripo Studio and choose Text-to-3D.",
    reference
      ? "2. Upload the downloaded reference image. Use the prompt above as the asset description and quality guide."
      : "2. Paste the prompt above. Keep the full subject visible and avoid text, logos, scenery, extra characters, or cropped limbs.",
    "3. Generate a textured model. Use retopology / low-poly tools when the mesh is too heavy.",
    "4. For a character, use Tripo Studio rigging only after the base shape and texture are satisfactory.",
    "5. Export or download the final asset as GLB (.glb).",
    "6. Return to GameForge → Playtest → 3D Asset Pipeline and upload the GLB into this same asset card.",
    "",
    "GAMEFORGE TARGET",
    `Recommended size: browser-optimized; preferably below ${asset.role === "environment" ? "25,000" : asset.role === "vehicle" ? "15,000" : "10,000"} faces and below 50 MB.`,
    "Textures: embedded in GLB where possible.",
    "Orientation: upright, centered, facing forward, with the pivot near the base/feet.",
    "",
    `Generated: ${new Date().toISOString()}`,
  ].join("\n");
}

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

function downloadReferenceImage(reference: ProjectReferenceImage, spec: GameBuildSpec) {
  const extension = reference.dataUrl.startsWith("data:image/png") ? "png" : reference.dataUrl.startsWith("data:image/webp") ? "webp" : "jpg";
  const anchor = document.createElement("a");
  anchor.href = reference.dataUrl;
  anchor.download = `${spec.title}-${reference.role}-${reference.name}.${extension}`.replace(/[^a-z0-9_.-]+/gi, "-");
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export default function TripoAssetPanel({ spec, onSpecChange }: Props) {
  const [references, setReferences] = useState<ProjectReferenceImage[]>([]);
  const assets = useMemo(() => {
    const planned = [...(spec.assets.generatedModels || [])];
    if (spec.assets.environmentPrompt && !planned.some((asset) => asset.role === "environment")) {
      planned.push({
        id: "signature-environment",
        role: "environment",
        prompt: spec.assets.environmentPrompt,
        provider: "tripo-studio",
        status: "planned",
      });
    }
    return planned;
  }, [spec.assets.environmentPrompt, spec.assets.generatedModels]);
  const [jobs, setJobs] = useState<Record<string, JobState>>({});
  const [availability, setAvailability] = useState<TripoAvailability>({
    checked: false,
    ready: false,
    mode: "checking",
    note: "Checking Tripo API wallet…",
  });
  const [studioMessage, setStudioMessage] = useState<Record<string, string>>({});
  const [generatedReferences, setGeneratedReferences] = useState<Record<string, string>>({});
  const [referenceBusy, setReferenceBusy] = useState<Record<string, boolean>>({});
  const [referenceErrors, setReferenceErrors] = useState<Record<string, string>>({});
  const [copiedAsset, setCopiedAsset] = useState("");
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const latestSpec = useRef(spec);

  useEffect(() => {
    latestSpec.current = spec;
  }, [spec]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const project = readActiveGameProject();
      if (!project || (spec.sourceProjectId && project.id !== spec.sourceProjectId)) {
        if (!cancelled) setReferences([]);
        return;
      }
      const images = await resolveProjectReferenceImages(project);
      if (!cancelled) setReferences(images);
    };
    void refresh();
    const listener = () => { void refresh(); };
    window.addEventListener(GAME_PROJECT_EVENT, listener);
    return () => {
      cancelled = true;
      window.removeEventListener(GAME_PROJECT_EVENT, listener);
    };
  }, [spec.sourceProjectId]);

  useEffect(() => {
    let active = true;
    fetch("/api/services/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: {
        services?: {
          tripo?: {
            configured?: boolean;
            verified?: boolean;
            mode?: string;
            balance?: number;
            note?: string;
          };
        };
      }) => {
        if (!active) return;
        const service = payload.services?.tripo;
        const balance = typeof service?.balance === "number" ? service.balance : undefined;
        setAvailability({
          checked: true,
          ready: Boolean(service?.configured && service?.verified && typeof balance === "number" && balance > 0),
          mode: service?.mode || "unavailable",
          balance,
          note: service?.note || "Tripo API status is unavailable.",
        });
      })
      .catch(() => {
        if (active) {
          setAvailability({
            checked: true,
            ready: false,
            mode: "unavailable",
            note: "GameForge could not verify the Tripo API wallet.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => () => {
    (Object.values(timers.current) as Array<ReturnType<typeof setTimeout>>).forEach((timer) => clearTimeout(timer));
  }, []);

  const updateJob = (assetId: string, update: Partial<JobState>) => {
    setJobs((current) => ({
      ...current,
      [assetId]: {
        ...(current[assetId] || {}),
        status: "idle",
        progress: 0,
        error: "",
        ...update,
      },
    }));
  };

  const applyGeneratedModels = (generatedModels: NonNullable<GameBuildSpec["assets"]["generatedModels"]>) => {
    const currentSpec = latestSpec.current;
    const playerModel = generatedModels.find((asset) => asset.role === "player" && asset.modelUrl)?.modelUrl || currentSpec.assets.playerModelUrl;
    const enemyModel = generatedModels.find((asset) => asset.role === "enemy" && asset.modelUrl)?.modelUrl || currentSpec.assets.enemyModelUrl;
    const vehicleModel = generatedModels.find((asset) => asset.role === "vehicle" && asset.modelUrl)?.modelUrl || currentSpec.assets.vehicleModelUrl;
    const environmentModel = generatedModels.find((asset) => asset.role === "environment" && asset.modelUrl)?.modelUrl || currentSpec.assets.environmentModelUrl;
    const nextSpec: GameBuildSpec = {
      ...currentSpec,
      assets: {
        ...currentSpec.assets,
        generatedModels,
        playerModelUrl: playerModel,
        enemyModelUrl: enemyModel,
        vehicleModelUrl: vehicleModel,
        environmentModelUrl: environmentModel,
      },
      pipeline: currentSpec.pipeline ? {
        ...currentSpec.pipeline,
        validationWarnings: currentSpec.pipeline.validationWarnings.filter((warning) => !warning.toLowerCase().includes("player will use")),
      } : currentSpec.pipeline,
    };
    latestSpec.current = nextSpec;
    onSpecChange(nextSpec);
  };

  const saveApiModel = (assetId: string, result: { taskId: string; modelUrl: string; previewUrl?: string; consumedCredits?: number }) => {
    const generatedModels = (latestSpec.current.assets.generatedModels || []).map((asset) => asset.id === assetId
      ? {
          ...asset,
          provider: "tripo" as const,
          status: "ready" as const,
          taskId: result.taskId,
          modelUrl: result.modelUrl,
          previewUrl: result.previewUrl,
          consumedCredits: result.consumedCredits,
          storage: "remote" as const,
        }
      : asset);
    applyGeneratedModels(generatedModels);
  };

  const saveStudioModel = async (asset: GeneratedAsset, file: File) => {
    setStudioMessage((current) => ({ ...current, [asset.id]: "Validating and storing the Studio GLB…" }));
    updateJob(asset.id, { status: "starting", progress: 35, error: "" });
    try {
      const record = await saveLocalGlb(asset.id, file, { role: asset.role, prompt: asset.prompt });
      const currentModels = latestSpec.current.assets.generatedModels || [];
      const sourceModels = currentModels.some((item) => item.id === asset.id) ? currentModels : [...currentModels, asset];
      const generatedModels = sourceModels.map((item) => item.id === asset.id
        ? {
            ...item,
            provider: "tripo-studio" as const,
            status: "ready" as const,
            modelUrl: localModelUrl(asset.id),
            taskId: undefined,
            consumedCredits: undefined,
            fileName: record.fileName,
            fileSize: record.fileSize,
            storage: "indexeddb" as const,
            importedAt: record.importedAt,
          }
        : item);
      applyGeneratedModels(generatedModels);
      updateJob(asset.id, { status: "ready", progress: 100, error: "" });
      setStudioMessage((current) => ({ ...current, [asset.id]: `${record.fileName} is connected from Tripo Studio and stored in this browser.` }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "The Studio GLB could not be imported.";
      updateJob(asset.id, { status: "failed", progress: 0, error: message });
      setStudioMessage((current) => ({ ...current, [asset.id]: "" }));
    }
  };

  const removeStudioModel = async (asset: GeneratedAsset) => {
    try {
      await deleteLocalModel(asset.id);
    } catch {
      // The specification still needs to be cleaned even when IndexedDB is already empty.
    }
    const currentModels = latestSpec.current.assets.generatedModels || [];
    const sourceModels = currentModels.some((item) => item.id === asset.id) ? currentModels : [...currentModels, asset];
    const generatedModels = sourceModels.map((item) => item.id === asset.id
      ? {
          ...item,
          provider: "tripo" as const,
          status: "planned" as const,
          modelUrl: undefined,
          previewUrl: undefined,
          taskId: undefined,
          consumedCredits: undefined,
          fileName: undefined,
          fileSize: undefined,
          storage: undefined,
          importedAt: undefined,
        }
      : item);
    applyGeneratedModels(generatedModels);
    updateJob(asset.id, { status: "idle", progress: 0, error: "" });
    setStudioMessage((current) => ({ ...current, [asset.id]: "Imported Studio model removed." }));
  };

  const copyStudioPrompt = async (asset: GeneratedAsset) => {
    try {
      await navigator.clipboard.writeText(asset.prompt);
      setCopiedAsset(asset.id);
      window.setTimeout(() => setCopiedAsset(""), 1500);
    } catch {
      downloadText(`${spec.title}-${asset.role}-prompt.txt`.replace(/[^a-z0-9_.-]+/gi, "-"), asset.prompt);
    }
  };

  const poll = async (assetId: string, taskId: string) => {
    try {
      const response = await fetch(`/api/tripo/status/${encodeURIComponent(taskId)}`, { cache: "no-store" });
      const payload = await response.json() as StatusPayload;
      if (!response.ok || !payload.task) throw new Error(payload.error || "Could not read the Tripo task.");
      const status = normalizedStatus(payload.task.status);
      updateJob(assetId, { taskId, status, progress: Math.max(0, Math.min(100, payload.task.progress || 0)), error: "" });
      if (status === "ready") {
        if (!payload.task.modelUrl) throw new Error("Tripo completed the task but did not return a model URL.");
        saveApiModel(assetId, {
          taskId,
          modelUrl: payload.task.modelUrl,
          previewUrl: payload.task.previewUrl,
          consumedCredits: payload.task.consumedCredits,
        });
        return;
      }
      if (status === "failed") throw new Error("Tripo could not generate this model. Adjust the prompt and try again.");
      timers.current[assetId] = setTimeout(() => void poll(assetId, taskId), 4500);
    } catch (error) {
      updateJob(assetId, { status: "failed", error: error instanceof Error ? error.message : "3D generation failed." });
    }
  };

  const startApiGeneration = async (assetId: string, prompt: string) => {
    if (!availability.ready) {
      updateJob(assetId, {
        status: "failed",
        progress: 0,
        error: availability.mode === "api-wallet-empty"
          ? "The API wallet has 0 credits. Use the Studio workflow below with your subscription credits instead."
          : availability.note,
      });
      return;
    }
    updateJob(assetId, { status: "starting", progress: 0, error: "" });
    try {
      const response = await fetch("/api/tripo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "text_to_model",
          prompt,
          role: assets.find((asset) => asset.id === assetId)?.role,
          faceLimit: assets.find((asset) => asset.id === assetId)?.role === "environment" ? 12000 : assets.find((asset) => asset.id === assetId)?.role === "vehicle" ? 8500 : 6500,
          texture: true,
          pbr: true,
        }),
      });
      const payload = await response.json() as { task?: { taskId: string }; error?: string };
      if (!response.ok || !payload.task?.taskId) throw new Error(payload.error || "Could not start the Tripo task.");
      updateJob(assetId, { taskId: payload.task.taskId, status: "queued", progress: 0, error: "" });
      void poll(assetId, payload.task.taskId);
    } catch (error) {
      updateJob(assetId, { status: "failed", error: error instanceof Error ? error.message : "3D generation failed." });
    }
  };

  const generateCloudflareReference = async (asset: GeneratedAsset) => {
    setReferenceBusy((current) => ({ ...current, [asset.id]: true }));
    setReferenceErrors((current) => ({ ...current, [asset.id]: "" }));
    try {
      const role = asset.role === "player"
        ? "character-model-reference"
        : asset.role === "vehicle"
          ? "vehicle-model-reference"
          : asset.role;
      const response = await fetch("/api/cloudflare/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: asset.prompt,
          role,
          artStyle: spec.artStyle,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { imageDataUrl?: string; error?: string; message?: string };
      if (!response.ok || !payload.imageDataUrl) {
        throw new Error(payload.error || payload.message || "Cloudflare could not create a model reference.");
      }
      setGeneratedReferences((current) => ({ ...current, [asset.id]: payload.imageDataUrl! }));
    } catch (error) {
      setReferenceErrors((current) => ({
        ...current,
        [asset.id]: error instanceof Error ? error.message : "Cloudflare reference generation failed.",
      }));
    } finally {
      setReferenceBusy((current) => ({ ...current, [asset.id]: false }));
    }
  };

  if (!assets.length) return null;

  return (
    <section className="rounded-[28px] border border-cyan-400/15 bg-cyan-400/[0.045] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">3D Asset Pipeline</p>
          <h2 className="mt-2 text-xl font-black">Tripo API + Studio bridge</h2>
        </div>
        <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-bold text-zinc-400">{assets.length} planned</span>
      </div>

      <div className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.055] p-4 text-xs leading-5 text-emerald-50/80">
        <p className="font-black text-emerald-200">Use the 3,200 Tripo Studio credits you already bought</p>
        <p className="mt-1">For each model: copy the prepared prompt, open Tripo Studio, generate and refine the asset there, export it as GLB, then upload the GLB into the matching card below. GameForge stores it locally and loads it in PlayCanvas.</p>
        <a href="https://studio.tripo3d.ai" target="_blank" rel="noreferrer" className="mt-2 inline-flex font-black text-emerald-200 underline underline-offset-4">Open Tripo Studio</a>
      </div>

      {!availability.ready && availability.checked && (
        <div className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-4 text-xs leading-5 text-amber-100/80">
          <p>{availability.mode === "api-wallet-empty" ? "Automatic API generation is unavailable because the API wallet is empty. The Studio import workflow remains fully available." : availability.note}</p>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {assets.map((asset) => {
          const savedReference = references.find((image) => image.role === asset.role);
          const generatedReference = generatedReferences[asset.id] && asset.role !== "prop"
            ? { role: asset.role as ProjectReferenceImage["role"], dataUrl: generatedReferences[asset.id], name: `${asset.role} full-body model reference` }
            : undefined;
          const reference = generatedReference || savedReference;
          const localReady = asset.provider === "tripo-studio" && isLocalModelUrl(asset.modelUrl);
          const job = jobs[asset.id] || {
            taskId: asset.taskId,
            status: asset.status === "ready" ? "ready" : asset.status === "failed" ? "failed" : asset.taskId ? "queued" : "idle",
            progress: asset.status === "ready" ? 100 : 0,
            error: "",
          };
          const busy = ["starting", "queued", "running"].includes(job.status);
          return (
            <article key={asset.id} className="rounded-2xl border border-white/8 bg-black/25 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black capitalize">{asset.role} model</p>
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-zinc-500">{asset.provider}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${job.status === "ready" ? "bg-green-400/10 text-green-300" : job.status === "failed" ? "bg-red-400/10 text-red-300" : "bg-violet-400/10 text-violet-300"}`}>{job.status}</span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-xs leading-5 text-zinc-500">{asset.prompt}</p>
                  <p className={`mt-2 text-[10px] font-black uppercase tracking-wider ${reference ? "text-cyan-300" : "text-zinc-600"}`}>
                    {reference ? `Image reference connected: ${reference.name}` : "No image reference — Studio will use text-to-3D"}
                  </p>
                  <button
                    type="button"
                    disabled={referenceBusy[asset.id]}
                    onClick={() => void generateCloudflareReference(asset)}
                    className="mt-3 rounded-lg border border-violet-300/20 bg-violet-300/10 px-3 py-2 text-xs font-black text-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {referenceBusy[asset.id]
                      ? "Generating reference…"
                      : asset.role === "environment"
                        ? "Generate environment reference"
                        : asset.role === "vehicle"
                          ? "Generate vehicle reference"
                          : "Generate full-body 3D reference"}
                  </button>
                  {referenceErrors[asset.id] && <p className="mt-2 text-xs leading-5 text-red-300">{referenceErrors[asset.id]}</p>}
                </div>
                {availability.ready && !asset.modelUrl && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void startApiGeneration(asset.id, asset.prompt)}
                    className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {busy ? "Generating…" : "Generate by API"}
                  </button>
                )}
              </div>

              {reference && (
                <div className="mt-4 grid gap-3 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.035] p-3 sm:grid-cols-[110px_1fr] sm:items-center">
                  <img src={reference.dataUrl} alt={`${reference.name} Cloudflare reference`} className="aspect-square w-full rounded-lg border border-white/10 bg-black/25 object-cover sm:w-[110px]" />
                  <div>
                    <p className="text-xs font-black text-cyan-100">Use this exact Cloudflare image in Tripo Studio</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-400">Download it, choose Image-to-3D in Tripo Studio, upload the image, generate with your Studio credits, export GLB, then import the GLB below.{asset.role === "environment" ? " The environment GLB is used as visual set dressing; the tested procedural layout still provides collisions and mission routes." : ""}</p>
                    <button type="button" onClick={() => downloadReferenceImage(reference, spec)} className="mt-2 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100">
                      Download Cloudflare reference
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 rounded-xl border border-emerald-300/10 bg-emerald-300/[0.035] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">Studio credits workflow</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void copyStudioPrompt(asset)} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs font-black text-zinc-200">
                    {copiedAsset === asset.id ? "Prompt copied" : "Copy Studio prompt"}
                  </button>
                  <button type="button" onClick={() => downloadText(`${spec.title}-${asset.role}-tripo-studio-brief.txt`.replace(/[^a-z0-9_.-]+/gi, "-"), studioBrief(spec, asset, reference))} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs font-black text-zinc-200">
                    Download brief
                  </button>
                  <a href="https://studio.tripo3d.ai" target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-100">
                    Open Studio
                  </a>
                  <label className="cursor-pointer rounded-lg border border-violet-300/20 bg-violet-300/10 px-3 py-2 text-xs font-black text-violet-100">
                    {localReady ? "Replace Studio GLB" : "Upload Studio GLB"}
                    <input
                      type="file"
                      accept=".glb,model/gltf-binary"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.currentTarget.value = "";
                        if (file) void saveStudioModel(asset, file);
                      }}
                    />
                  </label>
                  {localReady && (
                    <button type="button" onClick={() => void removeStudioModel(asset)} className="rounded-lg border border-red-300/15 bg-red-300/[0.06] px-3 py-2 text-xs font-black text-red-200">
                      Remove imported model
                    </button>
                  )}
                </div>
                {studioMessage[asset.id] && <p className="mt-2 text-xs leading-5 text-emerald-100/75">{studioMessage[asset.id]}</p>}
              </div>

              {busy && <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-900"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-300 transition-all" style={{ width: `${Math.max(5, job.progress)}%` }} /></div>}
              {asset.modelUrl && (
                <div className="mt-3 rounded-xl border border-green-300/10 bg-green-300/[0.04] p-3 text-xs leading-5 text-green-200/80">
                  <p>{localReady ? `Studio GLB connected: ${asset.fileName || "local model"}` : "API-generated model connected."}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-zinc-500">
                    {asset.taskId && <span>Task: {asset.taskId}</span>}
                    {typeof asset.consumedCredits === "number" && <span>API credits used: {asset.consumedCredits}</span>}
                    {asset.fileSize && <span>File: {formatBytes(asset.fileSize)}</span>}
                    {asset.storage === "indexeddb" && <span>Stored locally in this browser</span>}
                  </div>
                </div>
              )}
              {job.error && <p className="mt-3 text-xs leading-5 text-red-300">{job.error}</p>}
            </article>
          );
        })}
      </div>
      <p className="mt-4 text-xs leading-5 text-zinc-500">Important: GameForge cannot automatically spend Tripo Studio subscription credits. Those credits are used only after you open Tripo Studio and press Generate there. GameForge now supplies the exact Cloudflare references and prompts, then imports the exported GLB. Studio imports remain on this browser, so keep the original GLB files as backup.</p>
    </section>
  );
}
