import { NextResponse } from "next/server";
import {
  createTripoTask,
  requireTripoCredits,
  TripoApiError,
  type TripoGenerateInput,
  type TripoModelRole,
} from "@/lib/providers/tripo";
import {
  LOCKED_ART_NEGATIVE_PROMPT,
  buildStylized3DPrompt,
} from "@/lib/art-direction/stylized-3d";

export const runtime = "nodejs";

const ROLES: TripoModelRole[] = ["player", "vehicle", "enemy", "environment", "prop"];
const FILE_TYPES = ["png", "jpg", "jpeg", "webp"] as const;

function text(value: unknown, max = 1024) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function faceLimit(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const type = body.type === "image_to_model" ? "image_to_model" : "text_to_model";
    const role = ROLES.includes(body.role as TripoModelRole) ? body.role as TripoModelRole : "prop";

    let input: TripoGenerateInput;
    if (type === "image_to_model") {
      const imageUrl = text(body.imageUrl, 4000);
      const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl.trim() : "";
      if (!/^https:\/\//i.test(imageUrl) && !/^data:image\/(png|jpeg|webp);base64,/i.test(imageDataUrl)) {
        return NextResponse.json({ error: "Provide a public HTTPS imageUrl or a PNG/JPEG/WebP Design Studio imageDataUrl." }, { status: 400 });
      }
      if (imageDataUrl.length > 14_000_000) {
        return NextResponse.json({ error: "The Design Studio reference image is too large for automatic 3D generation." }, { status: 413 });
      }
      const fileType = FILE_TYPES.includes(body.fileType as (typeof FILE_TYPES)[number])
        ? body.fileType as (typeof FILE_TYPES)[number]
        : "png";
      input = {
        type,
        imageUrl: /^https:\/\//i.test(imageUrl) ? imageUrl : undefined,
        imageDataUrl: imageDataUrl || undefined,
        fileType,
        prompt: buildStylized3DPrompt(text(body.prompt), `${role} game-ready 3D model`),
        role,
        faceLimit: faceLimit(body.faceLimit),
        texture: body.texture !== false,
        pbr: body.pbr !== false,
      };
    } else {
      const sourcePrompt = text(body.prompt);
      if (sourcePrompt.length < 10) {
        return NextResponse.json({ error: "Provide a detailed 3D model prompt of at least 10 characters." }, { status: 400 });
      }
      input = {
        type,
        prompt: buildStylized3DPrompt(sourcePrompt, `${role} game-ready 3D model`),
        negativePrompt: `${LOCKED_ART_NEGATIVE_PROMPT}, ${text(body.negativePrompt, 255)}`.slice(0, 255),
        role,
        faceLimit: faceLimit(body.faceLimit),
        texture: body.texture !== false,
        pbr: body.pbr !== false,
      };
    }

    const estimatedCredits = type === "image_to_model" ? 50 : 40;
    const wallet = await requireTripoCredits(estimatedCredits);
    const task = await createTripoTask(input);
    return NextResponse.json({ task, wallet, estimatedCredits });
  } catch (error) {
    if (error instanceof TripoApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Tripo task creation failed:", error);
    return NextResponse.json({ error: "The 3D model task could not be started." }, { status: 500 });
  }
}
