"use client";

export type AutomaticModelRole = "player" | "environment" | "enemy" | "prop";

export type AutomaticModelResult = {
  status: "ready" | "unavailable" | "failed";
  modelUrl?: string;
  previewUrl?: string;
  taskId?: string;
  consumedCredits?: number;
  message: string;
};

type ServiceStatus = {
  services?: {
    tripo?: {
      configured?: boolean;
      verified?: boolean;
      balance?: number;
      note?: string;
    };
  };
};

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function generateAutomaticModel(options: {
  prompt: string;
  role: AutomaticModelRole;
  imageDataUrl?: string | null;
  faceLimit?: number;
  onProgress?: (progress: number, message: string) => void;
}): Promise<AutomaticModelResult> {
  try {
    const statusResponse = await fetch("/api/services/status", { cache: "no-store" });
    const statusPayload = await statusResponse.json().catch(() => ({})) as ServiceStatus;
    const tripo = statusPayload.services?.tripo;
    const balance = typeof tripo?.balance === "number" ? tripo.balance : 0;
    const requiredCredits = options.imageDataUrl ? 50 : 40;
    if (!statusResponse.ok || !tripo?.configured || !tripo.verified || balance < requiredCredits) {
      return {
        status: "unavailable",
        message: tripo?.note || (balance < requiredCredits
          ? `Tripo needs about ${requiredCredits} API credits for this ${options.imageDataUrl ? "image-to-3D" : "text-to-3D"} asset. GameForge kept the stylized procedural 3D fallback.`
          : "Tripo API is not ready. GameForge kept the stylized procedural 3D fallback."),
      };
    }

    options.onProgress?.(3, options.imageDataUrl ? "Sending the Cloudflare reference to Tripo…" : "Starting Tripo text-to-3D…");
    const response = await fetch("/api/tripo/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options.imageDataUrl ? {
        type: "image_to_model",
        imageDataUrl: options.imageDataUrl,
        prompt: options.prompt.slice(0, 1000),
        role: options.role,
        faceLimit: options.faceLimit || (options.role === "environment" ? 12000 : 6500),
        texture: true,
        pbr: true,
      } : {
        type: "text_to_model",
        prompt: options.prompt.slice(0, 1000),
        role: options.role,
        faceLimit: options.faceLimit || (options.role === "environment" ? 12000 : 6500),
        texture: true,
        pbr: true,
      }),
    });
    const payload = await response.json().catch(() => ({})) as { task?: { taskId?: string }; error?: string };
    const taskId = payload.task?.taskId;
    if (!response.ok || !taskId) throw new Error(payload.error || "Tripo could not start the 3D task.");

    const started = Date.now();
    while (Date.now() - started < 4 * 60 * 1000) {
      const taskResponse = await fetch(`/api/tripo/status/${encodeURIComponent(taskId)}`, { cache: "no-store" });
      const taskPayload = await taskResponse.json().catch(() => ({})) as {
        task?: {
          status?: string;
          progress?: number;
          modelUrl?: string;
          previewUrl?: string;
          consumedCredits?: number;
        };
        error?: string;
      };
      if (!taskResponse.ok || !taskPayload.task) throw new Error(taskPayload.error || "GameForge could not read the Tripo task.");
      const progress = Math.max(0, Math.min(100, Math.round(taskPayload.task.progress || 0)));
      options.onProgress?.(progress, `Building stylized 3D ${options.role} — ${progress}%`);
      const normalized = (taskPayload.task.status || "").toLowerCase();
      if (["success", "succeeded", "complete", "completed", "finished"].includes(normalized)) {
        if (!taskPayload.task.modelUrl) throw new Error("Tripo finished without a playable GLB model.");
        return {
          status: "ready",
          modelUrl: taskPayload.task.modelUrl,
          previewUrl: taskPayload.task.previewUrl,
          taskId,
          consumedCredits: taskPayload.task.consumedCredits,
          message: "The stylized 3D model is ready and connected to the Game Project.",
        };
      }
      if (["failed", "failure", "banned", "cancelled", "canceled", "error"].includes(normalized)) {
        throw new Error("Tripo could not generate this asset. GameForge kept the procedural 3D fallback.");
      }
      await sleep(4200);
    }

    return {
      status: "failed",
      taskId,
      message: "The Tripo task is still processing. Generate again later or continue with the procedural 3D fallback.",
    };
  } catch (error) {
    return {
      status: "failed",
      message: error instanceof Error ? error.message : "Automatic 3D generation failed. GameForge kept the procedural fallback.",
    };
  }
}
