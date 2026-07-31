export const LOCKED_ART_STYLE = "Stylized 3D" as const;

export const LOCKED_ART_DIRECTION =
  "Premium Stylized 3D with expressive proportions, readable silhouettes, hand-painted PBR materials, controlled surface detail, cohesive color scripting, cinematic lighting, and game-ready visual clarity";

export const LOCKED_CHARACTER_DIRECTION =
  "Stylized 3D game character with a clean readable silhouette, expressive proportions, coherent anatomy, simplified but premium material breakup, hand-painted PBR textures, and production-ready forms";

export const LOCKED_WORLD_DIRECTION =
  "Stylized 3D game world with layered playable spaces, readable routes, modular architecture, hand-painted PBR materials, distinctive landmarks, environmental storytelling, and clear gameplay affordances";

export const LOCKED_ART_NEGATIVE_PROMPT =
  "photorealism, realistic photography, live action, 2D illustration, flat vector art, pixel art, sprite sheet, untextured clay render, blurry geometry, unreadable silhouette, inconsistent art direction";

const CONFLICTING_MEDIUMS = [
  /\bphotoreal(?:ism|istic)?\b/gi,
  /\brealistic photography\b/gi,
  /\blive[- ]action\b/gi,
  /\b2d(?: illustration| art)?\b/gi,
  /\bpixel(?:ated)? art\b/gi,
  /\bsprite(?: sheet)?\b/gi,
  /\bflat vector(?: art)?\b/gi,
];

export function sanitizeStylized3DNotes(value: unknown, max = 900): string {
  if (typeof value !== "string") return "";
  let cleaned = value.trim();
  for (const expression of CONFLICTING_MEDIUMS) {
    cleaned = cleaned.replace(expression, "stylized 3D");
  }
  return cleaned.replace(/\s{2,}/g, " ").slice(0, max);
}

export function buildStylized3DPrompt(
  subject: string,
  purpose = "game asset",
  extra?: unknown,
): string {
  const safeSubject = typeof subject === "string" ? subject.trim() : "";
  const safeExtra = sanitizeStylized3DNotes(extra, 900);
  return [
    safeSubject,
    `${purpose} in the locked GameForge art system`,
    LOCKED_ART_DIRECTION,
    safeExtra ? `theme and production details: ${safeExtra}` : "",
    "must remain unmistakably stylized 3D, never photorealistic or 2D",
  ]
    .filter(Boolean)
    .join(", ")
    .slice(0, 2048);
}

export function lockedArtDirectionWithNotes(value: unknown): string {
  const notes = sanitizeStylized3DNotes(value, 700);
  return notes ? `${LOCKED_ART_DIRECTION}. Project-specific direction: ${notes}` : LOCKED_ART_DIRECTION;
}
