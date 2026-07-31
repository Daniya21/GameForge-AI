import { LOCKED_ART_STYLE, sanitizeStylized3DNotes } from "@/lib/art-direction/stylized-3d";

const ALLOWED_SCALES = [
  "Single city",
  "One region",
  "Continent",
  "Planet",
  "Multiple realms",
] as const;

const ALLOWED_FOCUS = [
  "Exploration Adventure",
  "Open-World RPG",
  "Survival",
  "Strategy",
  "Action Adventure",
  "Narrative Journey",
] as const;

const ALLOWED_STYLES = [LOCKED_ART_STYLE] as const;

type WorldRequest = {
  concept?: unknown;
  scale?: unknown;
  focus?: unknown;
  artStyle?: unknown;
  atmosphere?: unknown;
  visualNotes?: unknown;
};

type WorldBlueprint = {
  worldName: string;
  worldTagline: string;
  highConcept: string;
  playerFantasy: string;
  thematicCore: string;
  overview: string;
  geographyAndBiomes: string;
  regions: string[];
  factionsAndPowers: string;
  landmarks: string;
  traversalAndDiscovery: string;
  economyAndResources: string;
  conflictAndTension: string;
  cultureAndDailyLife: string;
  gameplayHooks: string[];
  visualIdentity: string;
  worldImagePrompt: string;
};

type GroqResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

type CloudflareResponse = {
  result?: { image?: string };
  success?: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  messages?: Array<{ code?: number; message?: string }>;
};

const WORLD_BLUEPRINT_SCHEMA = {
  type: "object",
  properties: {
    worldName: { type: "string" },
    worldTagline: { type: "string" },
    highConcept: { type: "string" },
    playerFantasy: { type: "string" },
    thematicCore: { type: "string" },
    overview: { type: "string" },
    geographyAndBiomes: { type: "string" },
    regions: {
      type: "array",
      minItems: 4,
      maxItems: 6,
      items: { type: "string" },
    },
    factionsAndPowers: { type: "string" },
    landmarks: { type: "string" },
    traversalAndDiscovery: { type: "string" },
    economyAndResources: { type: "string" },
    conflictAndTension: { type: "string" },
    cultureAndDailyLife: { type: "string" },
    gameplayHooks: {
      type: "array",
      minItems: 4,
      maxItems: 6,
      items: { type: "string" },
    },
    visualIdentity: { type: "string" },
    worldImagePrompt: { type: "string" },
  },
  required: [
    "worldName",
    "worldTagline",
    "highConcept",
    "playerFantasy",
    "thematicCore",
    "overview",
    "geographyAndBiomes",
    "regions",
    "factionsAndPowers",
    "landmarks",
    "traversalAndDiscovery",
    "economyAndResources",
    "conflictAndTension",
    "cultureAndDailyLife",
    "gameplayHooks",
    "visualIdentity",
    "worldImagePrompt",
  ],
  additionalProperties: false,
} as const;

const WORLD_SYSTEM_PROMPT = `You are GameForge AI's senior worldbuilding director, level designer, systems writer, and visual-development artist.

Create one original, advanced video-game world blueprint that faithfully expands the user's concept, preferred scale, gameplay focus, atmosphere, locked Stylized 3D art style, and optional visual notes.

NON-NEGOTIABLE RULES:
1. The user's concept is the source of truth. Never replace it with a generic fantasy or sci-fi template.
2. Build a coherent, playable world: geography, factions, culture, travel, resources, tension, objectives, and landmarks must reinforce each other.
3. Make every section concrete and specific. Use distinct places, materials, shapes, traversal routes, and gameplay opportunities.
4. regions must contain 4 to 6 complete location descriptions. Each item must start with a unique region name followed by an em dash and its gameplay purpose.
5. gameplayHooks must contain 4 to 6 complete playable activity descriptions.
6. The world image prompt must describe one cohesive stylized 3D game-environment reference with readable geometry, separated landmarks, clear routes, strong depth layers, and a composition suitable for image-to-3D landmark generation.
7. Do not include typography, logos, UI, watermarks, labels, title cards, brands, celebrities, copyrighted franchise names, or a living artist's signature style.
8. Return only the requested JSON object. Do not include markdown or commentary.`;

function isAllowed<T extends readonly string[]>(value: string, allowed: T): value is T[number] {
  return allowed.includes(value as T[number]);
}

function cleanText(value: unknown, fallback: string, maxLength = 1500): string {
  let text = "";
  if (typeof value === "string") {
    text = value;
  } else if (typeof value === "number" || typeof value === "boolean") {
    text = String(value);
  } else if (Array.isArray(value)) {
    text = value.map((item) => cleanText(item, "", 500)).filter(Boolean).join("; ");
  } else if (value && typeof value === "object") {
    text = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${key.replace(/([a-z])([A-Z])/g, "$1 $2")}: ${cleanText(item, "", 500)}`)
      .filter((item) => !item.endsWith(": "))
      .join(". ");
  }

  const normalized = text.replace(/```(?:json)?/gi, "").replace(/\s+/g, " ").trim();
  return (normalized || fallback).slice(0, maxLength);
}

function cleanList(value: unknown, fallbacks: string[]): string[] {
  let candidates: unknown[] = [];
  if (Array.isArray(value)) {
    candidates = value;
  } else if (value && typeof value === "object") {
    candidates = Object.values(value as Record<string, unknown>);
  } else if (typeof value === "string") {
    candidates = value
      .split(/\n|\r|;|\|/)
      .map((item) => item.replace(/^\s*\d+[.)-]?\s*/, "").trim())
      .filter(Boolean);
  }

  const result: string[] = [];
  for (const candidate of candidates) {
    const text = cleanText(candidate, "", 420);
    if (text && !result.some((item) => item.toLowerCase() === text.toLowerCase())) {
      result.push(text);
    }
  }
  for (const fallback of fallbacks) {
    if (result.length >= 5) break;
    if (!result.some((item) => item.toLowerCase() === fallback.toLowerCase())) result.push(fallback);
  }
  return result.slice(0, 5);
}

function titleCase(value: string) {
  return value
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function fallbackRegions(concept: string, focus: string): string[] {
  const text = `${concept} ${focus}`.toLowerCase();
  if (/bank|heist|vault|robber|security/.test(text)) {
    return [
      "Grand Atrium — the public-facing bank lobby, guarded entry point, and first stealth-navigation space.",
      "Security Operations Wing — a surveillance hub containing camera controls, patrol routes, and alarm systems.",
      "Executive Floors — layered offices, archives, and restricted corridors that support alternate infiltration paths.",
      "Vault Level — the heavily fortified objective zone with mechanical barriers, security puzzles, and the central reward.",
      "Service Tunnels and Extraction Street — maintenance passages leading to the final escape route and getaway point.",
    ];
  }
  if (/flight|bird|dragon|aircraft|sky|flying/.test(text)) {
    return [
      "High Nest Basin — a safe launch area where the player learns take-off, landing, and aerial movement.",
      "Windcarved Ridges — mountain corridors that create lift, hazards, and fast traversal routes.",
      "Cloudfall Valley — a wide exploration zone with prey, collectibles, and changing weather layers.",
      "Ancient Sky Ruins — a vertical landmark containing story discoveries and precision-flight challenges.",
      "Storm Crown — the dangerous final region where strong winds and the main objective converge.",
    ];
  }
  if (/race|car|vehicle|driving|road/.test(text)) {
    return [
      "Starting District — a readable staging area with garage access, tutorial turns, and the first checkpoint.",
      "Market Boulevard — a dense urban route with traffic, shortcuts, and destructible roadside props.",
      "Industrial Loop — a high-speed road network built around warehouses, ramps, and risky overtaking lanes.",
      "Canyon Expressway — an elevated route with long acceleration zones and dangerous edge barriers.",
      "Finale Circuit — the climactic checkpoint sequence combining every driving challenge and the finish line.",
    ];
  }
  return [
    "Arrival District — the player's readable starting region, tutorial space, and first narrative anchor.",
    "Central Landmark — the visual heart of the world, containing the main route junction and a major objective.",
    "Frontier Zone — a dangerous exploration area with environmental hazards, resources, and optional discoveries.",
    "Faction Territory — a socially active region shaped by local power, conflict, and character-driven quests.",
    "Final Threshold — the climactic region where traversal mastery, story tension, and the primary goal converge.",
  ];
}

function fallbackHooks(concept: string): string[] {
  const subject = cleanText(concept, "the world", 180);
  return [
    `Navigate a layered route network and discover alternate approaches that reflect ${subject}.`,
    "Interact with landmark systems to unlock routes, disable hazards, or reveal new mission information.",
    "Complete escalating objectives that move naturally between exploration, interaction, danger, and extraction.",
    "Use environmental clues, faction behavior, and readable visual language to make tactical decisions.",
    "Return to previously visited regions after world-state changes reveal new opportunities and consequences.",
  ];
}

function buildFallbackBlueprint(
  concept: string,
  scale: string,
  focus: string,
  atmosphere: string,
  visualNotes: string,
): WorldBlueprint {
  const firstSentence = concept.split(/[.!?]/)[0]?.trim() || concept;
  const conceptTitle = titleCase(firstSentence) || "The Forged World";
  const worldName = conceptTitle.length > 42 ? conceptTitle.slice(0, 42).trim() : conceptTitle;
  const regions = fallbackRegions(concept, focus);
  const visualExtra = visualNotes ? ` Additional visual direction: ${visualNotes}.` : "";

  return {
    worldName,
    worldTagline: `${atmosphere} paths through a world built for ${focus.toLowerCase()}.`,
    highConcept: `${concept} The result is structured as a playable ${scale.toLowerCase()} in a cohesive Stylized 3D art direction.`,
    playerFantasy: `Enter this world as the central playable hero, understand its systems, master its routes, and complete a clear escalating objective chain.`,
    thematicCore: `Control, discovery, pressure, and consequence shape every region while the player's choices determine how the world is approached.`,
    overview: `The world is organized around five readable regions connected by deliberate paths. Each region has a distinct gameplay role, visual silhouette, and story purpose, allowing the generated template to place missions and traversal markers reliably.`,
    geographyAndBiomes: `A layered ${scale.toLowerCase()} combines an accessible starting zone, a dominant central landmark, contrasting danger spaces, and a final objective region. Elevation, route width, landmark visibility, and environmental color guide the player without relying on text labels.`,
    regions,
    factionsAndPowers: `A dominant authority controls the safest routes and valuable resources, while local specialists, civilians, rivals, and opportunists create changing alliances and mission pressure.`,
    landmarks: `${regions.map((item) => item.split("—")[0].trim()).join(", ")}. Each landmark has a distinct silhouette and can be used as a mission, level-planning, or environmental-storytelling anchor.`,
    traversalAndDiscovery: `Primary paths make the critical objective chain readable, while side corridors, vertical routes, shortcuts, and concealed transitions reward exploration and support replayable approaches.`,
    economyAndResources: `Useful resources are placed near risk: tools, information, recovery items, upgrades, and objective materials encourage the player to explore rather than follow only the shortest path.`,
    conflictAndTension: `Pressure increases as the player crosses controlled territory, triggers security or environmental responses, and moves closer to the final region. Failure changes the immediate world state without breaking the objective chain.`,
    cultureAndDailyLife: `Architecture, props, lighting, ambient activity, and local routines communicate how people live in this world and how the central conflict disrupts ordinary life.`,
    gameplayHooks: fallbackHooks(concept),
    visualIdentity: `Premium Stylized 3D art with hand-painted PBR materials, readable silhouettes, expressive proportions, controlled detail, strong landmark colors, and cinematic lighting tuned to a ${atmosphere.toLowerCase()} mood.${visualExtra}`,
    worldImagePrompt: `A cohesive premium Stylized 3D game environment based on: ${concept}. Show five clearly separated playable regions connected by visible routes, one dominant signature landmark, readable foreground-midground-background layers, hand-painted PBR materials, expressive forms, cinematic ${atmosphere.toLowerCase()} lighting, no characters as the main subject, no text, no logo, no UI.`,
  };
}

function extractJson(content: string): unknown {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    throw new Error("No JSON object was returned.");
  }
}

function unwrapBlueprint(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return unwrapBlueprint(value[0]);
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  for (const key of ["worldBlueprint", "blueprint", "world", "result", "data"]) {
    const nested = record[key];
    if (nested && typeof nested === "object") return unwrapBlueprint(nested);
  }
  return record;
}

function normalizeWorldBlueprint(
  value: unknown,
  fallback: WorldBlueprint,
): { blueprint: WorldBlueprint; repaired: boolean } {
  const record = unwrapBlueprint(value);
  let repaired = false;
  const pickText = (aliases: string[], fallbackValue: string, maxLength = 1500) => {
    const source = aliases.map((key) => record[key]).find((item) => item !== undefined && item !== null);
    const text = cleanText(source, fallbackValue, maxLength);
    if (!source || text === fallbackValue) repaired = true;
    return text;
  };

  const regions = cleanList(
    record.regions ?? record.locations ?? record.zones ?? record.mapRegions,
    fallback.regions,
  );
  const gameplayHooks = cleanList(
    record.gameplayHooks ?? record.gameplay ?? record.activities ?? record.mechanics,
    fallback.gameplayHooks,
  );
  if (regions.length < 4 || gameplayHooks.length < 4) repaired = true;

  return {
    repaired,
    blueprint: {
      worldName: pickText(["worldName", "name", "title"], fallback.worldName, 90),
      worldTagline: pickText(["worldTagline", "tagline", "subtitle"], fallback.worldTagline, 180),
      highConcept: pickText(["highConcept", "concept", "summary"], fallback.highConcept),
      playerFantasy: pickText(["playerFantasy", "fantasy", "playerExperience"], fallback.playerFantasy),
      thematicCore: pickText(["thematicCore", "themes", "theme"], fallback.thematicCore),
      overview: pickText(["overview", "worldOverview", "description"], fallback.overview),
      geographyAndBiomes: pickText(["geographyAndBiomes", "geography", "biomes"], fallback.geographyAndBiomes),
      regions,
      factionsAndPowers: pickText(["factionsAndPowers", "factions", "powers"], fallback.factionsAndPowers),
      landmarks: pickText(["landmarks", "signatureLandmarks", "pointsOfInterest"], fallback.landmarks),
      traversalAndDiscovery: pickText(["traversalAndDiscovery", "traversal", "exploration"], fallback.traversalAndDiscovery),
      economyAndResources: pickText(["economyAndResources", "economy", "resources"], fallback.economyAndResources),
      conflictAndTension: pickText(["conflictAndTension", "conflict", "tension"], fallback.conflictAndTension),
      cultureAndDailyLife: pickText(["cultureAndDailyLife", "culture", "dailyLife"], fallback.cultureAndDailyLife),
      gameplayHooks,
      visualIdentity: pickText(["visualIdentity", "artDirection", "visualStyle"], fallback.visualIdentity),
      worldImagePrompt: pickText(["worldImagePrompt", "imagePrompt", "environmentPrompt"], fallback.worldImagePrompt, 2200),
    },
  };
}

function blueprintToSections(blueprint: WorldBlueprint) {
  return [
    { title: "World Name", content: `${blueprint.worldName} — ${blueprint.worldTagline}` },
    { title: "High Concept", content: blueprint.highConcept },
    { title: "Player Fantasy", content: blueprint.playerFantasy },
    { title: "Thematic Core", content: blueprint.thematicCore },
    { title: "World Overview", content: blueprint.overview },
    { title: "Geography & Biomes", content: blueprint.geographyAndBiomes },
    {
      title: "Regions of the World",
      content: blueprint.regions.map((region, index) => `${index + 1}. ${region}`).join("\n"),
    },
    { title: "Factions & Power Structure", content: blueprint.factionsAndPowers },
    { title: "Signature Landmarks", content: blueprint.landmarks },
    { title: "Traversal & Discovery", content: blueprint.traversalAndDiscovery },
    { title: "Economy & Resources", content: blueprint.economyAndResources },
    { title: "Conflict & Tension", content: blueprint.conflictAndTension },
    { title: "Culture & Daily Life", content: blueprint.cultureAndDailyLife },
    {
      title: "Gameplay Hooks",
      content: blueprint.gameplayHooks.map((item, index) => `${index + 1}. ${item}`).join("\n"),
    },
    { title: "Visual Identity", content: blueprint.visualIdentity },
  ];
}

type WorldLayoutKind = "urban" | "interior" | "nature" | "mountain" | "water" | "industrial" | "fantasy" | "lunar";

type WorldPropKind =
  | "building"
  | "habitat"
  | "rock"
  | "crater"
  | "tree"
  | "terminal"
  | "equipment"
  | "solar-panel"
  | "antenna"
  | "rover"
  | "mining-rig"
  | "oxygen-station"
  | "streetlight"
  | "barrier"
  | "crate"
  | "camera"
  | "vault-console"
  | "bridge"
  | "beacon"
  | "crystal"
  | "dock"
  | "landmark";

type WorldLayout = {
  seed: number;
  scale: string;
  focus: string;
  regions: Array<{
    id: string;
    name: string;
    description: string;
    kind: WorldLayoutKind;
    position: [number, number];
    radius: number;
    elevation: number;
    surface: string;
    architecture: string;
    equipment: string[];
    interactables: string[];
    detailDensity: number;
  }>;
  paths: Array<{ id: string; from: string; to: string; style: "road" | "trail" | "corridor" | "air-route"; width: number }>;
  props: Array<{
    id: string;
    regionId: string;
    name: string;
    kind: WorldPropKind;
    position: [number, number];
    elevation: number;
    scale: [number, number, number];
    rotation: number;
    interactive: boolean;
    collision: boolean;
    purpose: string;
  }>;
  playerSpawn: [number, number];
  objectiveAnchors: Array<{ id: string; label: string; position: [number, number]; regionId: string }>;
  detailLevel: "production";
  sourceImage: { width: number; height: number; model: string };
  landmarkPrompt: string;
};

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function seeded(seed: number, index: number) {
  let value = Math.imul(seed ^ (index * 374761393), 668265263);
  value = (value ^ (value >>> 13)) >>> 0;
  return ((value * 1274126177) >>> 0) / 4294967295;
}

function regionKind(value: string): WorldLayoutKind {
  const text = value.toLowerCase();
  if (/moon|lunar|regolith|crater|low gravity|space base|colony/.test(text)) return "lunar";
  if (/bank|vault|room|hall|interior|corridor|facility/.test(text)) return "interior";
  if (/ocean|sea|lake|river|water|harbor|coast|island/.test(text)) return "water";
  if (/mountain|cliff|ridge|peak|canyon|volcano/.test(text)) return "mountain";
  if (/forest|garden|jungle|field|wild|grove|swamp/.test(text)) return "nature";
  if (/factory|industrial|machine|mine|port|warehouse/.test(text)) return "industrial";
  if (/magic|realm|temple|citadel|crystal|ancient/.test(text)) return "fantasy";
  return "urban";
}

function worldProfile(blueprint: WorldBlueprint) {
  const text = `${blueprint.highConcept} ${blueprint.geographyAndBiomes} ${blueprint.landmarks}`.toLowerCase();
  if (/moon|lunar|regolith|crater|space colony/.test(text)) return "lunar";
  if (/bank|heist|vault|security/.test(text)) return "heist";
  if (/race|vehicle|highway|circuit/.test(text)) return "driving";
  if (/bird|dragon|flight|sky/.test(text)) return "flight";
  return "general";
}

function regionDetails(kind: WorldLayoutKind, profile: string) {
  if (kind === "lunar" || profile === "lunar") return {
    surface: "Layered lunar regolith, compacted traversal lanes, crater rims, dust banks, and exposed basalt shelves.",
    architecture: "Modular pressurized habitats, reinforced airlocks, utility gantries, landing platforms, and low-profile research modules.",
    equipment: ["solar arrays", "oxygen tanks", "rovers", "antenna dishes", "mining rigs", "cargo pallets"],
    interactables: ["airlock terminal", "oxygen station", "navigation beacon", "mining console"],
    density: 14,
  };
  if (kind === "interior" || profile === "heist") return {
    surface: "Polished floors, service corridors, secure thresholds, maintenance lanes, and clearly readable cover zones.",
    architecture: "Stylized institutional rooms, reinforced doors, security booths, vault structures, offices, and extraction access.",
    equipment: ["security cameras", "desks", "keypads", "barriers", "vault hardware", "evidence crates"],
    interactables: ["security terminal", "vault console", "door control", "objective crate"],
    density: 12,
  };
  if (kind === "nature") return {
    surface: "Layered soil, grass shelves, readable trails, roots, stones, and natural elevation changes.",
    architecture: "Small camps, bridges, lookout structures, shrines, and route markers blended into the landscape.",
    equipment: ["trail beacons", "supply crates", "rope bridges", "camp equipment"],
    interactables: ["navigation beacon", "supply cache", "bridge control"],
    density: 13,
  };
  if (kind === "mountain") return {
    surface: "Rock shelves, climbable ridges, ledges, scree fields, and clearly separated safe traversal paths.",
    architecture: "Cliff stations, bridges, carved tunnels, towers, and high-visibility navigation structures.",
    equipment: ["beacons", "cargo crates", "bridge machinery", "survey equipment"],
    interactables: ["summit beacon", "bridge control", "survey terminal"],
    density: 11,
  };
  if (kind === "industrial") return {
    surface: "Reinforced yards, loading lanes, service tracks, drainage channels, and hazard-marked work zones.",
    architecture: "Warehouses, processing towers, pipes, machine platforms, containers, and maintenance buildings.",
    equipment: ["machines", "cargo containers", "terminals", "barriers", "work lights"],
    interactables: ["machine console", "power terminal", "cargo objective"],
    density: 14,
  };
  if (kind === "fantasy") return {
    surface: "Sculpted stone paths, rune-marked terraces, luminous growth, and layered magical terrain.",
    architecture: "Stylized towers, shrines, bridges, crystal structures, and monumental ancient landmarks.",
    equipment: ["crystals", "braziers", "relic crates", "ritual machinery"],
    interactables: ["rune terminal", "crystal node", "ancient beacon"],
    density: 12,
  };
  if (kind === "water") return {
    surface: "Shallow water edges, docks, stable crossings, shoreline routes, and visible depth transitions.",
    architecture: "Piers, bridges, platforms, boathouses, and water-control structures.",
    equipment: ["dock lights", "cargo crates", "beacons", "small vessels"],
    interactables: ["dock control", "navigation beacon", "cargo objective"],
    density: 9,
  };
  return {
    surface: "Readable streets, plazas, alleys, sidewalks, elevation steps, and distinct traversal lanes.",
    architecture: "Stylized modular buildings, storefronts, towers, covered passages, and landmark structures.",
    equipment: ["streetlights", "barriers", "crates", "terminals", "parked vehicles"],
    interactables: ["public terminal", "navigation beacon", "objective crate"],
    density: profile === "driving" ? 10 : 12,
  };
}

function propCatalog(kind: WorldLayoutKind, profile: string): WorldPropKind[] {
  if (kind === "lunar" || profile === "lunar") return ["crater", "rock", "habitat", "solar-panel", "antenna", "rover", "mining-rig", "oxygen-station", "crate", "beacon"];
  if (kind === "interior" || profile === "heist") return ["building", "barrier", "terminal", "camera", "vault-console", "crate", "streetlight"];
  if (kind === "nature") return ["tree", "rock", "bridge", "beacon", "crate"];
  if (kind === "mountain") return ["rock", "rock", "bridge", "beacon", "equipment"];
  if (kind === "industrial") return ["building", "equipment", "crate", "barrier", "terminal", "streetlight"];
  if (kind === "fantasy") return ["landmark", "crystal", "bridge", "beacon", "rock"];
  if (kind === "water") return ["dock", "bridge", "beacon", "crate", "rock"];
  return ["building", "streetlight", "barrier", "crate", "terminal", "equipment"];
}

function propScale(kind: WorldPropKind, seed: number): [number, number, number] {
  const variation = 0.82 + seeded(seed, 9) * 0.5;
  const scales: Record<WorldPropKind, [number, number, number]> = {
    building: [3.8, 4.8, 3.8], habitat: [4.8, 2.4, 4], rock: [1.8, 1.5, 1.7], crater: [4.8, 0.35, 4.8], tree: [1.1, 4.8, 1.1], terminal: [0.8, 1.8, 0.65], equipment: [1.8, 1.5, 1.6], "solar-panel": [3.4, 0.3, 1.8], antenna: [1.2, 4.4, 1.2], rover: [2.4, 1.2, 3.6], "mining-rig": [3.2, 3.8, 3], "oxygen-station": [1.5, 2.2, 1.5], streetlight: [0.3, 3.8, 0.3], barrier: [2.4, 1, 0.5], crate: [1.2, 1.1, 1.2], camera: [0.45, 0.45, 0.8], "vault-console": [1.4, 2, 0.8], bridge: [4.8, 0.55, 2], beacon: [0.8, 3.2, 0.8], crystal: [1.1, 3.4, 1.1], dock: [4.8, 0.45, 3], landmark: [4.5, 7.5, 4.5],
  };
  const base = scales[kind];
  return [base[0] * variation, base[1] * variation, base[2] * variation];
}

function propFlags(kind: WorldPropKind) {
  const interactive = ["terminal", "vault-console", "oxygen-station", "beacon", "mining-rig", "crate"].includes(kind);
  const collision = !["crater", "streetlight", "camera", "solar-panel", "beacon"].includes(kind);
  return { interactive, collision };
}

function buildWorldLayout(blueprint: WorldBlueprint, scale: string, focus: string, sourceModel: string): WorldLayout {
  const seed = hashText(`${blueprint.worldName}|${blueprint.highConcept}`);
  const profile = worldProfile(blueprint);
  const count = Math.max(4, Math.min(7, blueprint.regions.length));
  const regions = blueprint.regions.slice(0, count).map((description, index) => {
    const angle = (index / count) * Math.PI * 2 + (seed % 360) * Math.PI / 180;
    const ring = index === 0 ? 0 : 18 + (index % 3) * 9;
    const name = description.split(/[—:,.]/)[0].replace(/^\d+[.)]\s*/, "").trim().slice(0, 64) || `Region ${index + 1}`;
    const kind = regionKind(`${description} ${blueprint.highConcept}`);
    const details = regionDetails(kind, profile);
    return {
      id: `region-${index + 1}`,
      name,
      description: description.slice(0, 420),
      kind,
      position: [Math.round(Math.cos(angle) * ring), Math.round(Math.sin(angle) * ring)] as [number, number],
      radius: 9 + (hashText(description) % 8),
      elevation: kind === "mountain" ? 12 + (index % 3) * 4 : kind === "water" ? 0 : kind === "lunar" ? 2 + index % 3 : 2 + (hashText(name) % 7),
      surface: details.surface,
      architecture: details.architecture,
      equipment: details.equipment,
      interactables: details.interactables,
      detailDensity: details.density,
    };
  });

  const paths = regions.slice(1).map((region, index) => ({
    id: `path-${index + 1}`,
    from: regions[index]?.id || regions[0].id,
    to: region.id,
    style: focus.includes("Flight") ? "air-route" as const : kindToPath(region.kind),
    width: region.kind === "interior" ? 4.2 : profile === "driving" ? 8.5 : 5.5,
  }));

  const props: WorldLayout["props"] = [];
  regions.forEach((region, regionIndex) => {
    const catalog = propCatalog(region.kind, profile);
    const count = Math.max(9, Math.min(18, region.detailDensity));
    for (let index = 0; index < count; index += 1) {
      const propSeed = seed + regionIndex * 1009 + index * 97;
      const kind = catalog[index % catalog.length];
      const angle = seeded(propSeed, 1) * Math.PI * 2;
      const distance = region.radius * (0.38 + seeded(propSeed, 2) * 0.42);
      const flags = propFlags(kind);
      props.push({
        id: `${region.id}-prop-${index + 1}`,
        regionId: region.id,
        name: `${region.name} ${kind.replace(/-/g, " ")} ${index + 1}`,
        kind,
        position: [
          Math.round((region.position[0] + Math.cos(angle) * distance) * 10) / 10,
          Math.round((region.position[1] + Math.sin(angle) * distance) * 10) / 10,
        ],
        elevation: region.kind === "mountain" ? Math.max(0, region.elevation * seeded(propSeed, 3) * 0.55) : 0,
        scale: propScale(kind, propSeed),
        rotation: Math.round(seeded(propSeed, 4) * 360),
        interactive: flags.interactive,
        collision: flags.collision,
        purpose: flags.interactive ? `Playable ${kind.replace(/-/g, " ")} used for objectives or world interaction.` : `Environmental ${kind.replace(/-/g, " ")} supporting navigation and visual storytelling.`,
      });
    }
  });

  const interactiveProps = props.filter((prop) => prop.interactive);
  const objectiveAnchors = regions.slice(0, 6).map((region, index) => {
    const prop = interactiveProps.find((item) => item.regionId === region.id);
    return {
      id: `objective-${index + 1}`,
      label: prop?.name || region.name,
      position: prop?.position || region.position,
      regionId: region.id,
    };
  });

  return {
    seed,
    scale,
    focus,
    regions,
    paths,
    props,
    playerSpawn: [regions[0].position[0] - Math.max(2, regions[0].radius * 0.35), regions[0].position[1]],
    objectiveAnchors,
    detailLevel: "production",
    sourceImage: { width: 1536, height: 1024, model: sourceModel },
    landmarkPrompt: `${blueprint.landmarks}. ${blueprint.visualIdentity}. Build one clean signature environment cluster, not the entire level.`.slice(0, 1000),
  };
}

function kindToPath(kind: WorldLayoutKind): "road" | "trail" | "corridor" | "air-route" {
  if (kind === "interior") return "corridor";
  if (kind === "nature" || kind === "mountain" || kind === "fantasy" || kind === "lunar") return "trail";
  return "road";
}

function buildWorldImagePrompt(
  blueprint: WorldBlueprint,
  _artStyle: string,
  atmosphere: string,
  scale: string,
  layout: WorldLayout,
) {
  const equipment = Array.from(new Set(layout.regions.flatMap((region) => [...region.equipment, ...region.interactables]))).slice(0, 14);
  const regionNames = layout.regions.map((region) => region.name).join(", ");
  const lunar = layout.regions.some((region) => region.kind === "lunar");
  return [
    "Create a production-quality high-angle isometric playable video-game level map in premium Stylized 3D",
    blueprint.worldImagePrompt,
    `regions: ${regionNames}`,
    `visible gameplay equipment and small environmental details: ${equipment.join(", ")}`,
    `world scale: ${scale}`,
    `atmosphere: ${atmosphere}`,
    lunar ? "detailed lunar regolith, sharp crater rims, habitat modules, solar panels, rovers, antenna arrays, mining machinery, oxygen equipment, cargo, landing lights" : "detailed modular architecture, readable paths, interactable terminals, equipment, cover, props, route markers, objective spaces and environmental storytelling",
    "show every main route as physically traversable, show doors and passages clearly, separate collision-safe paths from decorative set dressing",
    "crisp sharp focus across the entire image, high micro-detail, clean edges, no depth-of-field blur, no motion blur, no fog hiding the map, no empty generic terrain",
    "cohesive hand-painted PBR materials, readable silhouettes, clear foreground-midground-background layering, one signature landmark but many supporting props",
    "no characters as the main subject, no text, no labels, no title, no logo, no watermark, no UI, no border",
  ].join(", ").slice(0, 2048);
}

type CloudflareImageResult = {
  worldImageDataUrl: string | null;
  worldImageError: string | null;
  worldImageModel: string;
  worldImageWidth: number;
  worldImageHeight: number;
};

async function runCloudflareWorldImage(accountId: string, apiToken: string, model: string, prompt: string): Promise<CloudflareImageResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 115_000);
  const isSdxl = /stable-diffusion|sdxl/i.test(model);
  const width = isSdxl ? 1536 : 1024;
  const height = isSdxl ? 1024 : 1024;

  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(isSdxl ? {
        prompt,
        negative_prompt: "blurry, low resolution, empty terrain, flat lighting, unreadable layout, cropped map, fog obscuring routes, depth of field, motion blur, text, labels, logo, watermark, photorealism",
        width,
        height,
        num_steps: 20,
        guidance: 8.5,
        seed: Math.floor(Math.random() * 2_147_483_646) + 1,
      } : {
        prompt,
        steps: 8,
        seed: Math.floor(Math.random() * 2_147_483_646) + 1,
      }),
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") || "";
    if (!response.ok) {
      const payload = contentType.includes("json") ? await response.json().catch(() => ({})) as CloudflareResponse : {};
      const providerMessage = payload.errors?.[0]?.message || payload.messages?.[0]?.message;
      throw new Error(providerMessage || `Cloudflare returned HTTP ${response.status}.`);
    }

    if (contentType.includes("application/json")) {
      const payload = await response.json().catch(() => ({})) as CloudflareResponse;
      const imageBase64 = payload.result?.image?.trim();
      if (!imageBase64) throw new Error("Cloudflare returned an empty image.");
      return { worldImageDataUrl: `data:image/jpeg;base64,${imageBase64}`, worldImageError: null, worldImageModel: model, worldImageWidth: width, worldImageHeight: height };
    }

    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength) throw new Error("Cloudflare returned an empty image.");
    const mime = contentType.startsWith("image/") ? contentType.split(";")[0] : "image/png";
    return { worldImageDataUrl: `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`, worldImageError: null, worldImageModel: model, worldImageWidth: width, worldImageHeight: height };
  } finally {
    clearTimeout(timeout);
  }
}

async function createWorldImage(prompt: string): Promise<CloudflareImageResult> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const primaryModel = process.env.CLOUDFLARE_WORLD_IMAGE_MODEL?.trim() || "@cf/bytedance/stable-diffusion-xl-lightning";

  if (!accountId || !apiToken) {
    return {
      worldImageDataUrl: null,
      worldImageError: "World blueprint created, but Cloudflare image rendering is not connected. Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to .env.local, then restart the server.",
      worldImageModel: primaryModel,
      worldImageWidth: 1536,
      worldImageHeight: 1024,
    };
  }

  try {
    return await runCloudflareWorldImage(accountId, apiToken, primaryModel, prompt);
  } catch (primaryError) {
    console.warn("High-detail Cloudflare world model failed; trying the fast fallback.", primaryError);
    const fallbackModel = process.env.CLOUDFLARE_IMAGE_MODEL?.trim() || "@cf/black-forest-labs/flux-1-schnell";
    if (fallbackModel !== primaryModel) {
      try {
        const fallback = await runCloudflareWorldImage(accountId, apiToken, fallbackModel, prompt);
        return { ...fallback, worldImageError: `The high-detail world renderer was unavailable, so Gameforge used ${fallbackModel}. The structured 3D map and props are still complete.` };
      } catch (fallbackError) {
        console.warn("Cloudflare fallback world model failed.", fallbackError);
      }
    }
    const message = primaryError instanceof Error && primaryError.name === "AbortError"
      ? "World image rendering took too long and was stopped. The structured playable map was still created."
      : `World image rendering could not be completed${primaryError instanceof Error ? `: ${primaryError.message}` : "."}`;
    return { worldImageDataUrl: null, worldImageError: message, worldImageModel: primaryModel, worldImageWidth: 1536, worldImageHeight: 1024 };
  }
}

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  let body: WorldRequest;

  try {
    body = (await request.json()) as WorldRequest;
  } catch {
    return Response.json({ error: "The request body must be valid JSON." }, { status: 400 });
  }

  const concept = typeof body.concept === "string" ? body.concept.trim() : "";
  const scale = typeof body.scale === "string" ? body.scale.trim() : "";
  const focus = typeof body.focus === "string" ? body.focus.trim() : "";
  const artStyle = LOCKED_ART_STYLE;
  const atmosphere = typeof body.atmosphere === "string" ? body.atmosphere.trim() : "";
  const visualNotes = sanitizeStylized3DNotes(body.visualNotes, 900);

  if (concept.length < 14) {
    return Response.json(
      { error: "Describe the world concept in at least 14 characters." },
      { status: 400 },
    );
  }

  if (concept.length > 2000) {
    return Response.json(
      { error: "The world concept is too long. Keep it below 2,000 characters." },
      { status: 400 },
    );
  }

  if (visualNotes.length > 900) {
    return Response.json(
      { error: "Visual notes are too long. Keep them below 900 characters." },
      { status: 400 },
    );
  }

  if (!isAllowed(scale, ALLOWED_SCALES)) {
    return Response.json({ error: "Please select a valid world scale." }, { status: 400 });
  }

  if (!isAllowed(focus, ALLOWED_FOCUS)) {
    return Response.json({ error: "Please select a valid gameplay focus." }, { status: 400 });
  }

  if (!isAllowed(artStyle, ALLOWED_STYLES)) {
    return Response.json({ error: "Please select a valid world art style." }, { status: 400 });
  }

  if (atmosphere.length < 3 || atmosphere.length > 120) {
    return Response.json(
      { error: "Please provide a short atmosphere or mood description." },
      { status: 400 },
    );
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error:
          "World Builder is not connected. Add GROQ_API_KEY to .env.local and restart the development server.",
      },
      { status: 503 },
    );
  }

  const model = process.env.GROQ_FAST_MODEL?.trim() || process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-20b";
  const configuredWorldTokens = Number(process.env.GROQ_WORLD_MAX_TOKENS || 2800);
  const worldMaxTokens = Number.isFinite(configuredWorldTokens)
    ? Math.max(1400, Math.min(3000, Math.floor(configuredWorldTokens)))
    : 2800;

  const fallbackBlueprint = buildFallbackBlueprint(concept, scale, focus, atmosphere, visualNotes);

  async function requestGroqBlueprint(strict: boolean, maxTokens: number) {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: strict ? 0.45 : 0.35,
        max_completion_tokens: maxTokens,
        response_format: strict
          ? {
              type: "json_schema",
              json_schema: {
                name: "gameforge_world_blueprint",
                strict: true,
                schema: WORLD_BLUEPRINT_SCHEMA,
              },
            }
          : { type: "json_object" },
        messages: [
          { role: "system", content: WORLD_SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              task: "Create the complete playable world blueprint.",
              worldConcept: concept,
              worldScale: scale,
              gameplayFocus: focus,
              artStyle,
              atmosphere,
              visualNotes: visualNotes || "Infer strong, coherent visual details from the concept.",
            }),
          },
        ],
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as GroqResponse;
    return { response, payload };
  }

  let blueprint = fallbackBlueprint;
  let generationWarning: string | null = null;

  try {
    const strictAttempt = await requestGroqBlueprint(true, worldMaxTokens);
    const strictMessage = strictAttempt.payload.error?.message || "";

    if (strictAttempt.response.status === 401) {
      return Response.json({ error: "The Groq API key is invalid. Check GROQ_API_KEY in .env.local." }, { status: 502 });
    }
    if (strictAttempt.response.status === 403) {
      return Response.json({ error: "This Groq project cannot use the selected model. Check GROQ_FAST_MODEL." }, { status: 502 });
    }

    let normalized: { blueprint: WorldBlueprint; repaired: boolean } | null = null;
    const strictOutput = strictAttempt.payload.choices?.[0]?.message?.content?.trim();
    if (strictAttempt.response.ok && strictOutput) {
      try {
        normalized = normalizeWorldBlueprint(extractJson(strictOutput), fallbackBlueprint);
      } catch (error) {
        console.warn("Strict world blueprint parsing failed:", error);
      }
    }

    if (!normalized) {
      const fallbackAttempt = await requestGroqBlueprint(false, Math.min(2200, worldMaxTokens));
      const fallbackOutput = fallbackAttempt.payload.choices?.[0]?.message?.content?.trim();
      if (fallbackAttempt.response.ok && fallbackOutput) {
        try {
          normalized = normalizeWorldBlueprint(extractJson(fallbackOutput), fallbackBlueprint);
          generationWarning = "The AI response needed automatic repair, so Gameforge completed the missing map details safely.";
        } catch (error) {
          console.warn("Fallback world blueprint parsing failed:", error);
        }
      } else if (fallbackAttempt.response.status === 429 || strictAttempt.response.status === 429) {
        generationWarning = "Groq is temporarily rate-limited. Gameforge created a complete playable map blueprint locally from your concept instead.";
      } else if (!fallbackAttempt.response.ok) {
        generationWarning = fallbackAttempt.payload.error?.message
          ? `Groq could not complete the map blueprint (${fallbackAttempt.payload.error.message}). Gameforge used its local world architect instead.`
          : "Groq could not complete the map blueprint. Gameforge used its local world architect instead.";
      }
    }

    if (normalized) {
      blueprint = normalized.blueprint;
      if (normalized.repaired && !generationWarning) {
        generationWarning = "Gameforge repaired a few incomplete AI fields before building the playable map.";
      }
    } else if (!generationWarning) {
      generationWarning = strictMessage
        ? `The AI map response was incomplete (${strictMessage}). Gameforge completed the blueprint locally so generation could continue.`
        : "The AI map response was incomplete. Gameforge completed the blueprint locally so generation could continue.";
    }
  } catch (error) {
    console.error("World blueprint provider failed; using local architect:", error);
    generationWarning = "The online world planner could not finish this request. Gameforge created a complete playable map blueprint locally so the build could continue.";
  }

  try {
    const configuredWorldModel = process.env.CLOUDFLARE_WORLD_IMAGE_MODEL?.trim() || "@cf/bytedance/stable-diffusion-xl-lightning";
    const layout = buildWorldLayout(blueprint, scale, focus, configuredWorldModel);
    const worldImagePrompt = buildWorldImagePrompt(blueprint, artStyle, atmosphere, scale, layout);
    const worldImage = await createWorldImage(worldImagePrompt);
    layout.sourceImage = { width: worldImage.worldImageWidth, height: worldImage.worldImageHeight, model: worldImage.worldImageModel };

    return Response.json(
      {
        worldName: blueprint.worldName,
        worldTagline: blueprint.worldTagline,
        summary: blueprint.highConcept,
        sections: blueprintToSections(blueprint),
        worldImagePrompt,
        worldImageDataUrl: worldImage.worldImageDataUrl,
        worldImageError: worldImage.worldImageError,
        worldImageMeta: layout.sourceImage,
        generationWarning,
        layout,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("World rendering failed:", error);
    return Response.json(
      {
        error: error instanceof Error && error.message
          ? error.message
          : "The world could not be rendered. Please try again.",
      },
      { status: 500 },
    );
  }

}