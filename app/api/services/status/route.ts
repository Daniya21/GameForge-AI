import { NextResponse } from "next/server";
import { getTripoBalance } from "@/lib/providers/tripo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const cloudflareConfigured = Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim() && process.env.CLOUDFLARE_API_TOKEN?.trim(),
  );
  const tripoConfigured = Boolean(process.env.TRIPO_API_KEY?.trim());
  let tripoBalance: { balance: number; frozen: number } | null = null;
  let tripoError = "";

  if (tripoConfigured) {
    try {
      tripoBalance = await getTripoBalance();
    } catch (error) {
      tripoError = error instanceof Error ? error.message : "Tripo could not verify the API wallet.";
    }
  }

  return NextResponse.json({
    services: {
      groq: {
        configured: Boolean(process.env.GROQ_API_KEY),
        mode: process.env.GROQ_API_KEY ? "connected" : "not-configured",
        note: process.env.GROQ_API_KEY
          ? "Groq generation and refinement are enabled."
          : "Add GROQ_API_KEY to enable AI generation.",
      },
      cloudflare: {
        configured: cloudflareConfigured,
        mode: cloudflareConfigured ? "workers-ai-image-generation" : "not-configured",
        note: cloudflareConfigured
          ? `${process.env.CLOUDFLARE_IMAGE_MODEL?.trim() || "@cf/black-forest-labs/flux-1-schnell"} is ready for visual generation.`
          : "Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to enable avatars and concept art.",
      },
      elevenlabs: {
        configured: Boolean(process.env.ELEVENLABS_API_KEY),
        mode: process.env.ELEVENLABS_API_KEY ? "voice-and-sfx" : "browser-audio-fallback",
        note: process.env.ELEVENLABS_API_KEY
          ? "ElevenLabs voice and sound generation are enabled."
          : "Add ELEVENLABS_API_KEY to enable generated voice and sound.",
      },
      tripo: {
        configured: tripoConfigured,
        verified: Boolean(tripoBalance),
        mode: !tripoConfigured
          ? "procedural-fallback"
          : !tripoBalance
            ? "configured-unverified"
            : tripoBalance.balance > 0
              ? "api-wallet-ready"
              : "api-wallet-empty",
        model: process.env.TRIPO_MODEL?.trim() || "P1-20260311",
        balance: tripoBalance?.balance,
        frozen: tripoBalance?.frozen,
        note: !tripoConfigured
          ? "Add TRIPO_API_KEY to enable generated 3D assets. The P1 model is used automatically when TRIPO_MODEL is omitted."
          : tripoBalance
            ? tripoBalance.balance > 0
              ? `${process.env.TRIPO_MODEL?.trim() || "P1-20260311"} is connected with ${tripoBalance.balance} available API credits.`
              : "The Tripo API wallet has 0 credits. Automatic API generation is disabled, so GameForge will keep the stylized procedural player and world until API credits are added."
            : tripoError || "The Tripo key is configured, but its API wallet could not be verified.",
      },
    },
  });
}
