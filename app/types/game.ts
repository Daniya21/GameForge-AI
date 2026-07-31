export const GAME_TEMPLATES = [
  "arena",
  "survival",
  "collector",
  "runner",
  "platformer",
  "puzzle",
  "flight",
  "kart-racing",
] as const;

export type GameTemplate = (typeof GAME_TEMPLATES)[number];

export const GAME_TEMPLATE_FAMILIES = [
  "third-person-action",
  "open-world-flight",
  "driving-racing",
  "kart-racing",
] as const;

export type GameTemplateFamily = (typeof GAME_TEMPLATE_FAMILIES)[number];

export type WorldLayoutRegion = {
  id: string;
  name: string;
  description: string;
  kind: "urban" | "interior" | "nature" | "mountain" | "water" | "industrial" | "fantasy" | "lunar";
  position: [number, number];
  radius: number;
  elevation: number;
  surface?: string;
  architecture?: string;
  equipment?: string[];
  interactables?: string[];
  detailDensity?: number;
};

export type WorldLayoutPath = {
  id: string;
  from: string;
  to: string;
  style: "road" | "trail" | "corridor" | "air-route";
  width?: number;
};

export type WorldLayoutPropKind =
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

export type WorldLayoutProp = {
  id: string;
  regionId: string;
  name: string;
  kind: WorldLayoutPropKind;
  position: [number, number];
  elevation: number;
  scale: [number, number, number];
  rotation: number;
  interactive?: boolean;
  collision?: boolean;
  purpose?: string;
};

export type WorldLayout = {
  seed: number;
  scale: string;
  focus: string;
  regions: WorldLayoutRegion[];
  paths: WorldLayoutPath[];
  props?: WorldLayoutProp[];
  playerSpawn?: [number, number];
  objectiveAnchors?: Array<{ id: string; label: string; position: [number, number]; regionId: string }>;
  detailLevel?: "standard" | "production";
  sourceImage?: { width: number; height: number; model: string };
  landmarkPrompt: string;
};

export type RuntimeQuestBeat = {
  id: string;
  title: string;
  instruction: string;
  interaction: "reach" | "interact" | "collect" | "extract";
};

export type RuntimeDialogueBeat = {
  id: string;
  speaker: string;
  line: string;
  trigger: "opening" | "quest" | "alert" | "victory" | "defeat";
  questIndex?: number;
};

export type GameRuntimeContent = {
  opening: string;
  storyBeats: string[];
  quests: RuntimeQuestBeat[];
  dialogue: RuntimeDialogueBeat[];
  victory: string;
  defeat: string;
};

export type GameBuildBrief = {
  title: string;
  highConcept: string;
  playerRole: string;
  primaryGoal: string;
  setting: string;
  coreMechanics: string[];
  keyCharacters: string[];
  missionFlow: string[];
  artDirection: string;
  tone: string;
  sourceSections: string[];
};

export type BuildPipelineStageName =
  | "planning"
  | "template-selection"
  | "asset-planning"
  | "tripo-generation"
  | "scene-assembly"
  | "validation"
  | "ready";

export type BuildPipelineStage = {
  name: BuildPipelineStageName;
  label: string;
  status: "pending" | "running" | "complete" | "warning" | "failed";
  progress: number;
  detail: string;
};

export type GameCreationRequest = {
  idea: string;
  genre: string;
  platform: string;
  artStyle: string;
  audience: string;
  mode: string;
  quality: string;
  perspective: string;
  creativeTwist: boolean;
  revisionNotes?: string;
  previousBuild?: GameBuildSpec;
  templatePreference?: GameTemplateFamily | "automatic";
  templateId?: string;
  gameMode?: string;
  lapCount?: number;
  enableRivals?: boolean;
  vehicleModelUrl?: string;
  vehicleDescription?: string;
  sourceProject?: {
    id: string;
    title: string;
    context: string;
    completedSections: string[];
    buildBrief?: GameBuildBrief;
    runtimeContent?: GameRuntimeContent;
    worldLayout?: WorldLayout;
    playerModelUrl?: string;
    vehicleModelUrl?: string;
    vehicleDescription?: string;
    environmentModelUrl?: string;
  };
};

export type GameAssetRole = "player" | "vehicle" | "enemy" | "environment" | "prop";

export type GameBuildSpec = {
  schemaVersion: 2;
  buildId: string;
  title: string;
  tagline: string;
  premise: string;
  genre: string;
  platform: string;
  artStyle: string;
  audience: string;
  mode: string;
  quality: "balanced" | "high" | "ultra";
  perspective: "third-person" | "top-down" | "side-view";
  template: GameTemplate;
  templateFamily: GameTemplateFamily;
  templateId?: string;
  gameMode?: string;
  lapCount?: number;
  enableRivals?: boolean;
  templateReason: string;
  sourceProjectId?: string;
  designSources: string[];
  missionBrief: string;
  gameplaySummary: string;
  renderer: {
    engine: "gameforge-webgl" | "playcanvas";
    dimension: "3d";
    targetFps: 60;
    renderScale: number;
    dynamicLighting: boolean;
    softShadows: boolean;
    atmosphericFog: boolean;
    particles: "standard" | "high" | "cinematic";
    cameraMode: "follow" | "orbit" | "side-follow" | "flight-follow";
    fieldOfView: number;
  };
  world: {
    biome: string;
    atmosphere: string;
    size: number;
    obstacleCount: number;
    platformCount: number;
    verticality: number;
    propDensity: number;
    timeOfDay: "dawn" | "day" | "sunset" | "night";
    weather: "clear" | "mist" | "rain" | "embers" | "snow";
    layout?: WorldLayout;
  };
  visual: {
    sky: string;
    horizon: string;
    fog: string;
    ground: string;
    accent: string;
    secondaryAccent: string;
    player: string;
    enemy: string;
    collectible: string;
    projectile: string;
    metallic: number;
    roughness: number;
    bloom: number;
  };
  player: {
    name: string;
    speed: number;
    health: number;
    attackPower: number;
    attackCooldown: number;
    jumpForce: number;
    dashMultiplier: number;
  };
  enemy: {
    name: string;
    count: number;
    speed: number;
    health: number;
    damage: number;
    behavior: "chase" | "patrol" | "swarm" | "guard";
  };
  collectible: {
    name: string;
    count: number;
    scoreValue: number;
  };
  objective: {
    type: "eliminate" | "survive" | "collect" | "finish" | "activate" | "explore";
    description: string;
    target: number;
    timeLimitSeconds: number;
  };
  controls: {
    movement: string;
    primary: string;
    secondary: string;
    utility: string;
    camera: string;
  };
  narrative: {
    openingLine: string;
    victoryText: string;
    defeatText: string;
  };
  runtimeContent: GameRuntimeContent;
  assets: {
    pipeline: "procedural" | "hybrid" | "cloudflare" | "tripo";
    playerPrompt: string;
    enemyPrompt: string;
    environmentPrompt: string;
    propPrompts: string[];
    playerModelUrl?: string;
    vehicleModelUrl?: string;
    vehicleDescription?: string;
    enemyModelUrl?: string;
    environmentModelUrl?: string;
    attributionRequired: boolean;
    generatedModels?: Array<{
      id: string;
      role: GameAssetRole;
      prompt: string;
      provider: "library" | "tripo" | "tripo-studio" | "procedural";
      status: "planned" | "generating" | "ready" | "failed";
      modelUrl?: string;
      previewUrl?: string;
      taskId?: string;
      consumedCredits?: number;
      fileName?: string;
      fileSize?: number;
      storage?: "remote" | "indexeddb";
      importedAt?: string;
    }>;
  };
  audio: {
    provider: "procedural" | "elevenlabs";
    ambiencePrompt: string;
    musicPrompt: string;
    attackPrompt: string;
    impactPrompt: string;
    victoryPrompt: string;
    narratorVoiceLine: string;
    ambienceUrl?: string;
    attackUrl?: string;
    impactUrl?: string;
    narrationUrl?: string;
  };
  npc: {
    enabled: boolean;
    provider: "groq";
    characterName: string;
    role: string;
    personality: string;
    backstory: string;
    greeting: string;
    actionVocabulary: string[];
  };
  puzzleSequence: number[];
  thirdPerson?: {
    missionStages: Array<{
      id: string;
      title: string;
      instruction: string;
      position: [number, number, number];
      interaction: "reach" | "interact" | "collect" | "extract";
    }>;
    guardPatrolCount: number;
    detectionRadius: number;
    alarmEnabled: boolean;
    bankLayout: "compact" | "standard" | "extended";
  };
  driving?: {
    checkpointCount: number;
    trackLength: number;
    trafficCount: number;
    handling: "arcade" | "balanced";
  };
  flight?: {
    creature: "bird" | "dragon" | "aircraft";
    cruiseSpeed: number;
    maxSpeed: number;
    flapLift: number;
    glideEfficiency: number;
    turnRate: number;
    windStrength: number;
    thermalCount: number;
    freeRoam: boolean;
  };
  pipeline?: {
    stages: BuildPipelineStage[];
    estimatedTripoCredits: number;
    autoGenerate3d: boolean;
    validationWarnings: string[];
  };
  generatedAt: string;
};

export type RuntimeStats = {
  health: number;
  maxHealth: number;
  score: number;
  progress: number;
  target: number;
  elapsed: number;
  status: "ready" | "playing" | "paused" | "victory" | "defeat";
  defeated: number;
  collected: number;
  objectiveText: string;
  fps?: number;
  renderer?: string;
  altitude?: number;
  speed?: number;
  stamina?: number;
  wind?: number;
  weather?: string;
  speaker?: string;
  dialogueText?: string;
  storyBeat?: string;
  raceState?: "LOADING" | "READY" | "COUNTDOWN" | "RACING" | "FINISHED" | "PAUSED";
  currentLap?: number;
  lapCount?: number;
  currentCheckpoint?: number;
  checkpointCount?: number;
  currentLapTime?: number;
  totalRaceTime?: number;
  bestLapTime?: number;
  completedLapTimes?: number[];
  speedKph?: number;
  boostPercent?: number;
  finishPosition?: number;
  wrongWay?: boolean;
  countdownValue?: number | string;
  countdownText?: string;
};
