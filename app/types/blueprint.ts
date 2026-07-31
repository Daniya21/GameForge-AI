export type BlueprintOverview = {
  title: string;
  tagline: string;
  highConcept: string;
  genre: string;
  platform: string;
  artStyle: string;
  targetAudience: string;
  gameMode: string;
  perspective: string;
  uniqueSellingPoints: string[];
};

export type BlueprintGameplay = {
  playerFantasy: string;
  coreLoop: string[];
  mainMechanics: string[];
  objectives: string[];
  progression: string;
  winCondition: string;
  failureCondition: string;
};

export type BlueprintStory = {
  premise: string;
  playerRole: string;
  mainConflict: string;
  beginning: string;
  middle: string;
  ending: string;
  mainTwist: string;
  importantChoices: string[];
};

export type BlueprintLocation = {
  name: string;
  description: string;
  purpose: string;
  imagePrompt: string;
};

export type BlueprintFaction = {
  name: string;
  description: string;
  goal: string;
  relationshipToPlayer: string;
};

export type BlueprintWorld = {
  name: string;
  setting: string;
  atmosphere: string;
  history: string;
  worldRules: string[];
  locations: BlueprintLocation[];
  factions: BlueprintFaction[];
  hazards: string[];
  secrets: string[];
  imagePrompt: string;
};

export type BlueprintCharacter = {
  name: string;
  role: string;
  age: string;
  personality: string;
  backstory: string;
  motivation: string;
  abilities: string[];
  appearance: string;
  weapon: string;
  relationshipToPlayer: string;
  imagePrompt: string;
  imageUrl?: string;
};

export type BlueprintEnemy = {
  name: string;
  type: string;
  description: string;
  behavior: string;
  abilities: string[];
  weakness: string;
  rewards: string[];
  imagePrompt: string;
  imageUrl?: string;
};

export type BlueprintQuest = {
  title: string;
  type: string;
  description: string;
  objectives: string[];
  rewards: string[];
  failureCondition: string;
};

export type BlueprintProgression = {
  levelingSystem: string;
  skills: string[];
  unlockableAbilities: string[];
  equipment: string[];
  currencies: string[];
  upgradeSystem: string;
};

export type BlueprintArtDirection = {
  visualStyle: string;
  colorPalette: string[];
  lightingStyle: string;
  characterStyle: string;
  environmentStyle: string;
  interfaceStyle: string;
  coverArtPrompt: string;
  logoPrompt: string;
};

export type BlueprintAudioDirection = {
  musicStyle: string;
  ambience: string[];
  characterVoiceDirection: string;
  combatSounds: string[];
  environmentSounds: string[];
  victorySound: string;
  failureSound: string;
};

export type BlueprintTechnicalPlan = {
  recommendedEngine: string;
  cameraSystem: string;
  requiredSystems: string[];
  inputSystem: string;
  saveSystem: string;
  enemyAiRequirements: string[];
  performanceTargets: string[];
  recommendedDevelopmentOrder: string[];
};

export type BlueprintRoadmap = {
  prototype: string[];
  verticalSlice: string[];
  alpha: string[];
  beta: string[];
  finalPolish: string[];
  majorRisks: string[];
};

export type GameBlueprint = {
  overview: BlueprintOverview;
  gameplay: BlueprintGameplay;
  story: BlueprintStory;
  world: BlueprintWorld;
  characters: BlueprintCharacter[];
  enemies: BlueprintEnemy[];
  quests: BlueprintQuest[];
  progression: BlueprintProgression;
  artDirection: BlueprintArtDirection;
  audioDirection: BlueprintAudioDirection;
  technicalPlan: BlueprintTechnicalPlan;
  roadmap: BlueprintRoadmap;
  generatedAt: string;
};

export type CreateGameBlueprintRequest = {
  idea: string;
  genre: string;
  platform: string;
  artStyle: string;
  audience: string;
  mode: string;
  quality: string;
  perspective: string;
  creativeTwist: boolean;
};