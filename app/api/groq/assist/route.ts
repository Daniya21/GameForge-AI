import { NextResponse } from "next/server";

export const runtime = "nodejs";

type AssistRequest = {
  message?: string;
  contextTitle?: string;
  role?: string;
  summary?: string;
  worldContext?: string;
};

function localReply(body: AssistRequest) {
  const request = body.message?.trim() || "Improve this result";
  return `Production direction for ${body.contextTitle || "this concept"}: ${request}. Strengthen the core player fantasy, define one memorable visual signature, connect every mechanic to the objective, keep the first playable slice tightly scoped, and validate the result through a short playtest before expanding content.`;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AssistRequest;
  if (!body.message?.trim()) return NextResponse.json({ error: "A request is required." }, { status: 400 });

  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ provider: "local", reply: localReply(body) });

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.GROQ_FAST_MODEL || process.env.GROQ_MODEL || "openai/gpt-oss-20b",
        temperature: 0.72,
        max_tokens: 420,
        messages: [
          {
            role: "system",
            content: `You are the Gameforge production assistant. Improve game-design work with precise, practical recommendations. Context title: ${body.contextTitle || "Untitled"}. Module role: ${body.role || "game design"}. Existing result: ${body.summary || "Not supplied"}. World context: ${body.worldContext || "Not supplied"}. Answer directly in compact paragraphs. Preserve the user's intent, avoid generic filler, and recommend implementation-ready improvements.`,
          },
          { role: "user", content: body.message.trim() },
        ],
      }),
    });
    if (!response.ok) return NextResponse.json({ provider: "local", reply: localReply(body) });
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const reply = payload.choices?.[0]?.message?.content?.trim();
    return NextResponse.json({ provider: "groq", reply: reply || localReply(body) });
  } catch {
    return NextResponse.json({ provider: "local", reply: localReply(body) });
  }
}
