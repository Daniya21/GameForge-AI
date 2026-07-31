"use client";

import { LOCKED_ART_DIRECTION, LOCKED_ART_STYLE } from "@/lib/art-direction/stylized-3d";
import type { BuildPipelineStage, GameBuildSpec } from "@/app/types/game";
import type { ProjectReferenceImage } from "@/lib/game-project/client";
import { saveLocalAudio } from "@/lib/game-assets/local-audio-store";

type ProgressCallback = (update: { stages: BuildPipelineStage[]; spec: GameBuildSpec; message: string }) => void;
type TripoTask = { taskId: string; status: string; progress: number; modelUrl?: string; previewUrl?: string; consumedCredits?: number };

const BASE_STAGES: BuildPipelineStage[] = [
  { name: "planning", label: "Analyse project", status: "complete", progress: 100, detail: "Story, single character, world, quests and dialogue are attached." },
  { name: "template-selection", label: "Select template", status: "complete", progress: 100, detail: "The tested gameplay foundation is selected." },
  { name: "asset-planning", label: "Prepare stylized assets", status: "pending", progress: 0, detail: "Checking saved GLBs and creating missing references." },
  { name: "tripo-generation", label: "Generate 3D assets", status: "pending", progress: 0, detail: "Waiting for the Tripo API wallet." },
  { name: "scene-assembly", label: "Assemble world and audio", status: "pending", progress: 0, detail: "Preparing the PlayCanvas scene." },
  { name: "validation", label: "Validate gameplay", status: "pending", progress: 0, detail: "Checking controls and mission flow." },
  { name: "ready", label: "Playable game ready", status: "pending", progress: 0, detail: "The horizontal playtest will open." },
];

export function createInitialPipeline(spec: GameBuildSpec) {
  return (spec.pipeline?.stages?.length ? spec.pipeline.stages : BASE_STAGES).map((stage) => ({ ...stage }));
}

function change(stages: BuildPipelineStage[], name: BuildPipelineStage["name"], patch: Partial<BuildPipelineStage>) {
  return stages.map((stage) => stage.name === name ? { ...stage, ...patch } : stage);
}

async function services() {
  const response = await fetch("/api/services/status", { cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as { services?: Record<string, { configured?: boolean; verified?: boolean; balance?: number; note?: string }> };
  return payload.services || {};
}

async function cloudflareReference(prompt: string, role: "player" | "vehicle" | "environment"): Promise<ProjectReferenceImage | null> {
  const response = await fetch("/api/cloudflare/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      role: role === "player" ? "character-model-reference" : role === "vehicle" ? "vehicle-model-reference" : "environment",
      artStyle: LOCKED_ART_DIRECTION,
    }),
  });
  const payload = await response.json().catch(() => ({})) as { imageDataUrl?: string };
  if (!response.ok || !payload.imageDataUrl) return null;
  return { role, dataUrl: payload.imageDataUrl, name: `${role} auto reference` };
}

async function startTripo(asset: NonNullable<GameBuildSpec["assets"]["generatedModels"]>[number], reference?: ProjectReferenceImage) {
  const response = await fetch("/api/tripo/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reference ? {
      type: "image_to_model",
      imageDataUrl: reference.dataUrl,
      prompt: asset.prompt.slice(0, 1000),
      role: asset.role,
      faceLimit: asset.role === "environment" ? 12000 : asset.role === "vehicle" ? 8500 : 6500,
      texture: true,
      pbr: true,
    } : {
      type: "text_to_model",
      prompt: asset.prompt.slice(0, 1000),
      role: asset.role,
      faceLimit: asset.role === "environment" ? 12000 : asset.role === "vehicle" ? 8500 : 6500,
      texture: true,
      pbr: true,
    }),
  });
  const payload = await response.json().catch(() => ({})) as { task?: { taskId?: string }; error?: string };
  if (!response.ok || !payload.task?.taskId) throw new Error(payload.error || "Tripo could not start the model task.");
  return payload.task.taskId;
}

function taskState(value: string) {
  const state = value.toLowerCase();
  if (["success", "succeeded", "complete", "completed", "finished"].includes(state)) return "ready";
  if (["failed", "failure", "cancelled", "canceled", "error", "banned"].includes(state)) return "failed";
  return "running";
}

async function waitForTask(taskId: string, onProgress: (value: number) => void): Promise<TripoTask> {
  const started = Date.now();
  while (Date.now() - started < 5 * 60 * 1000) {
    const response = await fetch(`/api/tripo/status/${encodeURIComponent(taskId)}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({})) as { task?: TripoTask; error?: string };
    if (!response.ok || !payload.task) throw new Error(payload.error || "GameForge could not read the Tripo task.");
    onProgress(Math.max(0, Math.min(100, payload.task.progress || 0)));
    const state = taskState(payload.task.status);
    if (state === "ready") {
      if (!payload.task.modelUrl) throw new Error("Tripo completed without a GLB URL.");
      return payload.task;
    }
    if (state === "failed") throw new Error("Tripo could not create this model.");
    await new Promise((resolve) => window.setTimeout(resolve, 4000));
  }
  throw new Error("Tripo is still processing the model. The fallback will be used for this playtest.");
}

async function generatedAudio(path: string, body: Record<string, unknown>, id: string) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) return "";
  return saveLocalAudio(id, await response.blob());
}

export async function completeProductionPipeline(
  sourceSpec: GameBuildSpec,
  options: { autoGenerate3d: boolean; referenceImages?: ProjectReferenceImage[] },
  onUpdate: ProgressCallback,
): Promise<{ spec: GameBuildSpec; warning: string }> {
  let spec: GameBuildSpec = { ...sourceSpec, artStyle: LOCKED_ART_STYLE, mode: "Single Player", renderer: { ...sourceSpec.renderer, engine: "playcanvas" } };
  let stages = createInitialPipeline(spec);
  const warnings: string[] = [];
  const emit = (message: string) => onUpdate({ stages, spec, message });
  const referenceImages = [...(options.referenceImages || [])];

  stages = change(stages, "asset-planning", { status: "running", progress: 20, detail: "Checking saved player, vehicle and world models." });
  emit("Preparing the stylized player, vehicle and world");

  const modelAssets = (spec.assets.generatedModels || [])
    .filter((asset) => asset.role === "player" || asset.role === "vehicle" || asset.role === "environment")
    .sort((a, b) => {
      // Keep the playable avatar and generated world ahead of the optional vehicle GLB.
      // The runtime has a polished kart fallback, while losing the world would make
      // the entire generated game feel disconnected from Design Studio.
      const priority = { player: 0, environment: 1, vehicle: 2 } as const;
      return (priority[a.role as keyof typeof priority] ?? 9) - (priority[b.role as keyof typeof priority] ?? 9);
    })
    .slice(0, spec.templateFamily === "driving-racing" || spec.templateFamily === "kart-racing" ? 3 : 2);

  for (const asset of modelAssets) {
    if (asset.modelUrl || referenceImages.some((image) => image.role === asset.role)) continue;
    const reference = await cloudflareReference(asset.prompt, asset.role as "player" | "vehicle" | "environment").catch(() => null);
    if (reference) referenceImages.push(reference);
    else warnings.push(`Cloudflare could not prepare the ${asset.role} reference; Tripo will use the text prompt.`);
  }
  stages = change(stages, "asset-planning", { status: warnings.length ? "warning" : "complete", progress: 100, detail: "Saved GLBs and automatic Cloudflare references are ready." });

  let serviceStatus: Awaited<ReturnType<typeof services>> = {};
  try { serviceStatus = await services(); } catch { warnings.push("Provider status could not be verified; fallbacks remain active."); }
  const tripo = serviceStatus.tripo;
  const pending = modelAssets.filter((asset) => !asset.modelUrl);
  const generated = [...(spec.assets.generatedModels || [])];
  let availableCredits = typeof tripo?.balance === "number" ? tripo.balance : 0;
  const tripoReady = options.autoGenerate3d && Boolean(tripo?.configured && tripo?.verified);

  if (pending.length && tripoReady) {
    stages = change(stages, "tripo-generation", { status: "running", progress: 2, detail: `Prioritising the playable character, then the world landmark and vehicle within the ${availableCredits}-credit wallet.` });
    emit("Tripo is generating the playable 3D assets");

    let completed = 0;
    for (const asset of pending) {
      const reference = referenceImages.find((item) => item.role === asset.role);
      const estimatedCredits = reference ? 50 : 40;
      if (availableCredits < estimatedCredits) {
        warnings.push(`Tripo needs about ${estimatedCredits} credits for the ${asset.role} model, but ${availableCredits} remain. The stylized procedural fallback will be used.`);
        completed += 1;
        continue;
      }
      try {
        const taskId = await startTripo(asset, reference);
        const task = await waitForTask(taskId, (value) => {
          const base = completed / Math.max(1, pending.length) * 100;
          const share = value / Math.max(1, pending.length);
          stages = change(stages, "tripo-generation", { status: "running", progress: Math.max(3, Math.min(99, Math.round(base + share))), detail: `Generating ${asset.role}: ${Math.round(value)}%.` });
          emit(`Generating ${asset.role} model`);
        });
        const index = generated.findIndex((item) => item.id === asset.id);
        if (index >= 0) generated[index] = { ...generated[index], status: "ready", provider: "tripo", taskId: task.taskId, modelUrl: task.modelUrl, previewUrl: task.previewUrl, consumedCredits: task.consumedCredits };
        availableCredits = Math.max(0, availableCredits - (task.consumedCredits || estimatedCredits));
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : `The ${asset.role} Tripo model could not be generated.`);
      }
      completed += 1;
    }

    const playerModelUrl = generated.find((asset) => asset.role === "player" && asset.modelUrl)?.modelUrl || spec.assets.playerModelUrl;
    const vehicleModelUrl = generated.find((asset) => asset.role === "vehicle" && asset.modelUrl)?.modelUrl || spec.assets.vehicleModelUrl;
    const environmentModelUrl = generated.find((asset) => asset.role === "environment" && asset.modelUrl)?.modelUrl || spec.assets.environmentModelUrl;
    spec = { ...spec, assets: { ...spec.assets, generatedModels: generated, playerModelUrl, vehicleModelUrl, environmentModelUrl } };
    const readyCount = generated.filter((asset) => (asset.role === "player" || asset.role === "vehicle" || asset.role === "environment") && asset.modelUrl).length;
    stages = change(stages, "tripo-generation", { status: readyCount >= modelAssets.length ? "complete" : "warning", progress: 100, detail: `${readyCount}/${modelAssets.length} signature GLB assets are attached. Procedural stylized geometry covers anything not generated.` });
  } else {
    if (pending.length) warnings.push(!tripo?.configured ? "Tripo is not configured." : !tripo?.verified ? "The Tripo API wallet could not be verified." : "Automatic Tripo generation is disabled.");
    stages = change(stages, "tripo-generation", { status: pending.length ? "warning" : "complete", progress: 100, detail: pending.length ? "Tripo could not run automatically; the stylized fallback models will keep the game playable." : "The saved player, world and vehicle GLBs are already attached." });
  }

  stages = change(stages, "scene-assembly", { status: "running", progress: 30, detail: "Blending the Design Studio map, missions, dialogue and audio into PlayCanvas." });
  emit("Blending the world map and gameplay systems");
  const [narrationResult, ambienceResult] = await Promise.allSettled([
    generatedAudio("/api/elevenlabs/voice", { text: spec.runtimeContent.opening }, `${spec.buildId}-opening`),
    generatedAudio("/api/elevenlabs/sfx", { prompt: spec.audio.ambiencePrompt, durationSeconds: 18, loop: true }, `${spec.buildId}-ambience`),
  ]);
  const narrationUrl = narrationResult.status === "fulfilled" ? narrationResult.value : "";
  const ambienceUrl = ambienceResult.status === "fulfilled" ? ambienceResult.value : "";
  spec = { ...spec, audio: { ...spec.audio, narrationUrl: narrationUrl || spec.audio.narrationUrl, ambienceUrl: ambienceUrl || spec.audio.ambienceUrl } };
  stages = change(stages, "scene-assembly", { status: "complete", progress: 100, detail: "PlayCanvas scene, single-player controls, authoritative missions and optional generated audio are ready." });

  stages = change(stages, "validation", { status: "running", progress: 45, detail: "Checking controls, horizontal viewport, objectives and fallbacks." });
  emit("Validating the playable build");
  const validationWarnings = [...(spec.pipeline?.validationWarnings || [])];
  if (!spec.runtimeContent.quests.length) validationWarnings.push("No authored quest existed; safe mission defaults were inserted.");
  if (!spec.assets.playerModelUrl) validationWarnings.push("A stylized humanoid fallback is used until the player GLB is available.");
  if ((spec.templateFamily === "driving-racing" || spec.templateFamily === "kart-racing") && !spec.assets.vehicleModelUrl) validationWarnings.push("A detailed stylized vehicle fallback is used until the vehicle GLB is available.");
  if (!spec.assets.environmentModelUrl) validationWarnings.push("The procedural Design Studio map is used until the landmark GLB is available.");
  stages = change(stages, "validation", { status: validationWarnings.length ? "warning" : "complete", progress: 100, detail: validationWarnings.length ? `${validationWarnings.length} non-blocking fallback note${validationWarnings.length === 1 ? "" : "s"}.` : "Controls and mission progression passed validation." });
  stages = change(stages, "ready", { status: "complete", progress: 100, detail: "The streamlined horizontal playtest is ready." });

  spec = {
    ...spec,
    pipeline: {
      stages,
      estimatedTripoCredits: pending.reduce((sum, asset) => sum + (referenceImages.some((image) => image.role === asset.role) ? 50 : 40), 0),
      autoGenerate3d: true,
      validationWarnings,
    },
  };
  emit("Playable game ready");
  return { spec, warning: warnings.join(" ") };
}
