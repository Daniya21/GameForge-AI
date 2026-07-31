import { generateGroqJson, GroqApiError } from "@/lib/ai/groq";
import type { ScenarioAnalysis } from "@/lib/plan-b/project-insights";

const SYSTEM_PROMPT = `You are GameForge AI's Change Impact Director.
Analyze one proposed game-design change against the supplied connected project context.
Return only valid JSON. Be specific, causal, and concise. Do not reveal hidden reasoning.
Treat Story, Characters, World, Quests, Dialogue, Production, and GDD as connected systems.
The permanent visual production direction is premium Stylized 3D.
The JSON must contain:
{
  "title": string,
  "summary": string,
  "affectedCount": number,
  "impactItems": [
    {
      "area": "story" | "characters" | "world" | "quests" | "dialogue" | "mentor" | "gdd" | "production",
      "label": string,
      "severity": "High" | "Medium" | "Low",
      "reason": string,
      "actions": [string, string]
    }
  ],
  "conflicts": [string, string, string],
  "opportunities": [string, string, string],
  "productionImpact": string,
  "recommendation": string
}`;

function isAnalysis(value: unknown): value is ScenarioAnalysis {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.title === "string" &&
    typeof record.summary === "string" &&
    typeof record.affectedCount === "number" &&
    Array.isArray(record.impactItems) &&
    record.impactItems.length >= 5 &&
    Array.isArray(record.conflicts) &&
    Array.isArray(record.opportunities) &&
    typeof record.productionImpact === "string" &&
    typeof record.recommendation === "string"
  );
}

export async function POST(request: Request) {
  let body: { change?: unknown; projectContext?: unknown };
  try {
    body = (await request.json()) as { change?: unknown; projectContext?: unknown };
  } catch {
    return Response.json({ error: "The request body must be valid JSON." }, { status: 400 });
  }

  const change = typeof body.change === "string" ? body.change.trim() : "";
  const projectContext = typeof body.projectContext === "string" ? body.projectContext.trim() : "";
  if (change.length < 8) return Response.json({ error: "Describe a clearer design change." }, { status: 400 });

  try {
    const generated = await generateGroqJson<ScenarioAnalysis>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: JSON.stringify({
        task: "Create a connected change impact analysis.",
        proposedChange: change,
        projectContext: projectContext.slice(0, 8000),
        requirements: {
          impactItems: "Include all materially affected systems.",
          affectedCount: "Count concrete downstream design elements, not only categories.",
          explainability: "Explain why each system changes and provide actionable updates.",
        },
      }),
      temperature: 0.35,
      maxCompletionTokens: 2600,
    });

    if (!isAnalysis(generated)) {
      return Response.json({ error: "The AI impact report was incomplete." }, { status: 502 });
    }
    return Response.json({ analysis: generated, provider: "groq" });
  } catch (error) {
    const status = error instanceof GroqApiError ? error.status : 502;
    const message = error instanceof Error ? error.message : "The AI impact analysis could not be completed.";
    return Response.json({ error: message }, { status });
  }
}
