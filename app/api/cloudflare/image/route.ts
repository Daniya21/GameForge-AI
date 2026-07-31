import { NextResponse } from "next/server";
import {
  LOCKED_ART_DIRECTION,
  LOCKED_ART_NEGATIVE_PROMPT,
  buildStylized3DPrompt,
} from "@/lib/art-direction/stylized-3d";

type CloudflareImageRequest = {
  prompt?: unknown;
  role?: unknown;
  artStyle?: unknown;
};

type CloudflareResponse = {
  result?: { image?: string };
  success?: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  messages?: Array<{ code?: number; message?: string }>;
};

const ROLE_DIRECTION: Record<string, string> = {
  character: "single original video-game character, clear face and silhouette, fully clothed, coherent anatomy, production concept art",
  "character-model-reference": "single original full-body video-game character model reference, head-to-toe visible, neutral A-pose, arms slightly away from torso, feet visible, centered, plain simple background, fully clothed, coherent anatomy, no cropped limbs, no props blocking the body",
  "vehicle-model-reference": "single original stylized 3D game vehicle reference, full vehicle visible from a clean three-quarter front angle, four wheels clearly visible, readable cockpit and driver seat, centered, plain background, no driver, no environment, no cropped parts",
  environment: "wide cinematic video-game environment, layered foreground midground and background, strong landmark, no main character",
  enemy: "single original video-game enemy or creature, readable combat silhouette, coherent anatomy, production concept art",
  prop: "single original video-game prop or object, clean readable form, detailed materials, production concept art",
};

function buildPrompt(input: CloudflareImageRequest) {
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  const role = typeof input.role === "string" ? input.role.trim().toLowerCase() : "prop";
  const roleDirection = ROLE_DIRECTION[role] || ROLE_DIRECTION.prop;
  return buildStylized3DPrompt(
    [
      prompt,
      roleDirection,
      LOCKED_ART_DIRECTION,
      "cinematic lighting, strong composition, production-ready detail, no text, no title, no logo, no watermark, no UI, no border",
      `avoid: ${LOCKED_ART_NEGATIVE_PROMPT}`,
    ].filter(Boolean).join(", "),
    `${role} visual production`,
  );
}

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as CloudflareImageRequest;
  const prompt = buildPrompt(body);

  if (prompt.length < 12) {
    return NextResponse.json({ error: "A more detailed visual prompt is required." }, { status: 400 });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const model = process.env.CLOUDFLARE_IMAGE_MODEL?.trim() || "@cf/black-forest-labs/flux-1-schnell";

  if (!accountId || !apiToken) {
    return NextResponse.json(
      {
        configured: false,
        provider: "cloudflare",
        prompt,
        message: "Cloudflare image generation is not configured. Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to .env.local, then restart Gameforge.",
      },
      { status: 409 },
    );
  }

  const rawSteps = Number(process.env.CLOUDFLARE_IMAGE_STEPS || "8");
  const steps = Number.isFinite(rawSteps) ? Math.max(1, Math.min(8, Math.round(rawSteps))) : 8;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 100_000);

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          steps,
          seed: Math.floor(Math.random() * 2_147_483_646) + 1,
        }),
        signal: controller.signal,
      },
    );

    const payload = (await response.json().catch(() => ({}))) as CloudflareResponse;

    if (!response.ok || payload.success === false) {
      const providerMessage = payload.errors?.[0]?.message || payload.messages?.[0]?.message;
      const error =
        response.status === 401 || response.status === 403
          ? "Cloudflare authentication failed. Check the Account ID and Workers AI API token in .env.local."
          : response.status === 429
            ? "Cloudflare Workers AI free allocation or temporary rate limit has been reached. Try again after the limit resets."
            : providerMessage || "Cloudflare could not generate the image.";
      return NextResponse.json({ error }, { status: response.status || 502 });
    }

    const image = payload.result?.image?.trim();
    if (!image) {
      return NextResponse.json({ error: "Cloudflare returned an empty image." }, { status: 502 });
    }

    return NextResponse.json({
      configured: true,
      provider: "cloudflare",
      prompt,
      imageDataUrl: `data:image/jpeg;base64,${image}`,
      model,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Cloudflare image generation took too long and was stopped."
        : "Gameforge could not reach Cloudflare Workers AI.";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
