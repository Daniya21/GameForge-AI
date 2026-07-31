import { NextResponse } from "next/server";

export const runtime = "nodejs";

type VoiceRequest = { text?: string; voiceId?: string; stability?: number; similarity?: number };

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as VoiceRequest;
  const text = body.text?.trim();
  if (!text) return NextResponse.json({ error: "Dialogue text is required." }, { status: 400 });
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        configured: false,
        provider: "browser-speech-fallback",
        text,
        message: "ElevenLabs is not configured. The browser speech fallback remains available for previewing dialogue.",
      },
      { status: 409 },
    );
  }

  const voiceId = body.voiceId?.trim() || process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: text.slice(0, 5000),
      model_id: "eleven_flash_v2_5",
      voice_settings: {
        stability: Math.max(0, Math.min(1, body.stability ?? 0.48)),
        similarity_boost: Math.max(0, Math.min(1, body.similarity ?? 0.72)),
        style: 0.25,
        use_speaker_boost: true,
      },
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json({ error: "ElevenLabs could not generate the voice line.", detail }, { status: response.status });
  }
  return new Response(await response.arrayBuffer(), {
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "audio/mpeg",
      "Cache-Control": "private, max-age=3600",
      "X-Gameforge-Provider": "elevenlabs",
    },
  });
}
