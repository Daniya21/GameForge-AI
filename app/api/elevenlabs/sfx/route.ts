import { NextResponse } from "next/server";

export const runtime = "nodejs";

type SoundRequest = { prompt?: string; durationSeconds?: number; loop?: boolean };

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as SoundRequest;
  const text = body.prompt?.trim();
  if (!text) return NextResponse.json({ error: "A sound description is required." }, { status: 400 });
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        configured: false,
        provider: "procedural-web-audio",
        prompt: text,
        message: "ElevenLabs is not configured. Gameforge will keep using its built-in procedural Web Audio fallback.",
      },
      { status: 409 },
    );
  }

  const response = await fetch("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128", {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      duration_seconds: Math.max(0.5, Math.min(30, body.durationSeconds || 5)),
      prompt_influence: 0.4,
      model_id: "eleven_text_to_sound_v2",
      loop: Boolean(body.loop),
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json({ error: "ElevenLabs could not generate the sound.", detail }, { status: response.status });
  }
  return new Response(await response.arrayBuffer(), {
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "audio/mpeg",
      "Cache-Control": "private, max-age=3600",
      "X-Gameforge-Provider": "elevenlabs",
    },
  });
}
