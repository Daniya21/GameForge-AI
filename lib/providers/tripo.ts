const TRIPO_BASE_URL = "https://api.tripo3d.ai/v2/openapi";
const DEFAULT_TRIPO_MODEL = "P1-20260311";

export type TripoModelRole = "player" | "vehicle" | "enemy" | "environment" | "prop";

export type TripoGenerateInput =
  | {
      type: "text_to_model";
      prompt: string;
      role?: TripoModelRole;
      negativePrompt?: string;
      faceLimit?: number;
      texture?: boolean;
      pbr?: boolean;
    }
  | {
      type: "image_to_model";
      imageUrl?: string;
      imageDataUrl?: string;
      fileType?: "png" | "jpg" | "jpeg" | "webp";
      prompt?: string;
      role?: TripoModelRole;
      faceLimit?: number;
      texture?: boolean;
      pbr?: boolean;
    };

export type TripoUploadResponse = {
  code?: number;
  message?: string;
  data?: {
    image_token?: string;
    [key: string]: unknown;
  };
};

export type TripoTaskResponse = {
  code?: number;
  message?: string;
  data?: {
    task_id?: string;
    [key: string]: unknown;
  };
};

export type TripoStatusResponse = {
  code?: number;
  message?: string;
  data?: {
    task_id?: string;
    status?: string;
    progress?: number;
    output?: {
      model?: string;
      pbr_model?: string;
      rendered_image?: string;
      [key: string]: unknown;
    };
    consumed_credit?: number;
    [key: string]: unknown;
  };
};

export type TripoBalanceResponse = {
  code?: number;
  message?: string;
  data?: {
    balance?: number;
    frozen?: number;
  };
};

export class TripoApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "TripoApiError";
    this.status = status;
  }
}

function apiKey() {
  const value = process.env.TRIPO_API_KEY?.trim();
  if (!value) {
    throw new TripoApiError(
      "Tripo is not connected. Add TRIPO_API_KEY to .env.local and restart the development server.",
      503,
    );
  }
  return value;
}

function modelVersion() {
  return process.env.TRIPO_MODEL?.trim() || DEFAULT_TRIPO_MODEL;
}

function clampFaceLimit(value?: number) {
  if (!Number.isFinite(value)) return 5000;
  return Math.max(1000, Math.min(20000, Math.round(value || 5000)));
}

async function tripoFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${TRIPO_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });
  } catch (error) {
    console.error("Tripo network request failed:", error);
    throw new TripoApiError("Tripo could not be reached. Check your connection and try again.", 502);
  }

  const payload = (await response.json().catch(() => ({}))) as T & {
    message?: string;
    code?: number;
  };

  if (!response.ok || (typeof payload.code === "number" && payload.code !== 0)) {
    const providerMessage = typeof payload.message === "string" ? payload.message : "";
    if (response.status === 401 || response.status === 403) {
      throw new TripoApiError("The Tripo API key is invalid or does not have access to this operation.", 502);
    }
    if (response.status === 429) {
      throw new TripoApiError("The Tripo request limit or available API credits have been reached.", 429);
    }
    throw new TripoApiError(providerMessage || "Tripo could not complete the request.", 502);
  }

  return payload;
}

export function isSafeTripoTaskId(value: string) {
  return /^[A-Za-z0-9_-]{8,160}$/.test(value);
}

function parseImageDataUrl(value: string) {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=\s]+)$/i.exec(value.trim());
  if (!match) throw new TripoApiError("The Design Studio image must be a PNG, JPEG, or WebP data URL.", 400);
  const format = match[1].toLowerCase();
  const bytes = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
  if (!bytes.length) throw new TripoApiError("The Design Studio image is empty.", 400);
  if (bytes.length > 10 * 1024 * 1024) throw new TripoApiError("The Design Studio image is larger than Tripo's 10 MB upload limit.", 400);
  const type = format === "jpeg" ? "jpg" : format as "png" | "webp";
  return { bytes, type, mime: format === "jpeg" ? "image/jpeg" : `image/${format}` };
}

async function uploadTripoImageDataUrl(imageDataUrl: string) {
  const { bytes, type, mime } = parseImageDataUrl(imageDataUrl);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), `gameforge-reference.${type}`);

  let response: Response;
  try {
    response = await fetch(`${TRIPO_BASE_URL}/upload/sts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey()}` },
      body: form,
      cache: "no-store",
    });
  } catch (error) {
    console.error("Tripo image upload failed:", error);
    throw new TripoApiError("Tripo could not upload the Design Studio reference image.", 502);
  }

  const payload = await response.json().catch(() => ({})) as TripoUploadResponse;
  if (!response.ok || (typeof payload.code === "number" && payload.code !== 0)) {
    throw new TripoApiError(payload.message || "Tripo rejected the Design Studio reference image.", response.status || 502);
  }
  const token = payload.data?.image_token;
  if (!token) throw new TripoApiError("Tripo uploaded the reference image but did not return an image token.", 502);
  return { token, type };
}

export async function createTripoTask(input: TripoGenerateInput) {
  const common = {
    model_version: modelVersion(),
    face_limit: clampFaceLimit(input.faceLimit),
    texture: input.texture !== false,
    pbr: input.pbr !== false,
  };

  let body: Record<string, unknown>;
  if (input.type === "text_to_model") {
    body = {
      type: "text_to_model",
      prompt: input.prompt.trim(),
      negative_prompt: input.negativePrompt?.trim() || undefined,
      ...common,
    };
  } else if (input.imageDataUrl) {
    const uploaded = await uploadTripoImageDataUrl(input.imageDataUrl);
    body = {
      type: "image_to_model",
      file: { type: input.fileType || uploaded.type, file_token: uploaded.token },
      ...common,
    };
  } else if (input.imageUrl) {
    body = {
      type: "image_to_model",
      file: { type: input.fileType || "png", url: input.imageUrl.trim() },
      ...common,
    };
  } else {
    throw new TripoApiError("Image-to-3D requires a Design Studio image or a public HTTPS image URL.", 400);
  }

  const result = await tripoFetch<TripoTaskResponse>("/task", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const taskId = result.data?.task_id;
  if (!taskId) throw new TripoApiError("Tripo accepted the request but did not return a task ID.", 502);

  return {
    taskId,
    provider: "tripo" as const,
    model: modelVersion(),
    status: "queued" as const,
  };
}

export async function getTripoBalance() {
  const result = await tripoFetch<TripoBalanceResponse>("/user/balance", { method: "GET" });
  return {
    balance: typeof result.data?.balance === "number" ? result.data.balance : 0,
    frozen: typeof result.data?.frozen === "number" ? result.data.frozen : 0,
  };
}


export async function requireTripoCredits(minimum = 1) {
  const wallet = await getTripoBalance();
  if (wallet.balance < minimum) {
    throw new TripoApiError(
      `Your Tripo API key is valid, but this task needs about ${minimum} API credits and the wallet has ${wallet.balance}. Add credits in the Tripo API platform, then try again.`,
      402,
    );
  }
  return wallet;
}

export async function getTripoTask(taskId: string) {
  if (!isSafeTripoTaskId(taskId)) throw new TripoApiError("Invalid Tripo task ID.", 400);
  const result = await tripoFetch<TripoStatusResponse>(`/task/${encodeURIComponent(taskId)}`, {
    method: "GET",
  });
  const data = result.data || {};
  return {
    taskId,
    status: typeof data.status === "string" ? data.status : "unknown",
    progress: typeof data.progress === "number" ? data.progress : 0,
    providerModelUrl: data.output?.pbr_model || data.output?.model || "",
    modelUrl: data.output?.pbr_model || data.output?.model || "",
    previewUrl: data.output?.rendered_image || "",
    consumedCredits: typeof data.consumed_credit === "number" ? data.consumed_credit : undefined,
    raw: data,
  };
}
