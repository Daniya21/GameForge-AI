import type { GameBlueprint } from "@/app/types/blueprint";

export const mockBlueprint: GameBlueprint = {
  overview: {
    title: "Echoes of the Skyforge",
    tagline: "Rebuild a shattered world above the clouds.",
    highConcept:
      "A story-driven fantasy adventure where the player explores floating islands, restores ancient technology, and decides which factions will control the future.",
    genre: "Fantasy Adventure RPG",
    platform: "PC",
    artStyle: "Stylized 3D",
    targetAudience: "Teen",
    gameMode: "Single Player",
    perspective: "Third Person",
    uniqueSellingPoints: [
      "Floating-island exploration",
      "Faction-based story choices",
      "Ancient technology mixed with fantasy magic",
    ],
  },

  gameplay: {
    playerFantasy:
      "Become an explorer capable of restoring lost machines and shaping the future of a broken world.",
    coreLoop: [
      "Explore a floating island",
      "Discover secrets and resources",
      "Fight enemies",
      "Complete quests",
      "Upgrade abilities and equipment",
    ],
    mainMechanics: [
      "Third-person exploration",
      "Melee and ranged combat",
      "Environmental puzzles",
      "Technology restoration",
      "Dialogue choices",
    ],
    objectives: [
      "Restore the Skyforge",
      "Unite or defeat the major factions",
      "Discover the cause of the world's destruction",
    ],
    progression:
      "Players gain experience, unlock abilities, improve equipment, and gain access to new islands.",
    winCondition:
      "Restore the Skyforge and decide how its power will be used.",
    failureCondition:
      "The player is defeated in combat or fails certain time-sensitive missions.",
  },

  story: {
    premise:
      "The floating world of Aerath is slowly collapsing after its ancient energy source was destroyed.",
    playerRole:
      "The player is a young salvager who discovers the ability to activate forgotten machines.",
    mainConflict:
      "Several rival factions want to control the Skyforge, the only machine capable of saving the world.",
    beginning:
      "The player discovers a damaged Skyforge key inside a ruined temple.",
    middle:
      "The player travels between islands, builds alliances, and learns that the disaster was deliberately caused.",
    ending:
      "The player restores the Skyforge and chooses whether to share, destroy, or control its power.",
    mainTwist:
      "The player's mentor was involved in the original destruction of the Skyforge.",
    importantChoices: [
      "Which faction to support",
      "Whether to forgive the mentor",
      "How to use the restored Skyforge",
    ],
  },

  world: {
    name: "Aerath",
    setting:
      "A fantasy world made of floating islands suspended above a poisonous storm.",
    atmosphere:
      "Mysterious, adventurous, hopeful, and occasionally dangerous.",
    history:
      "Aerath was once connected by powerful machines until a war shattered the world.",
    worldRules: [
      "Ancient machines require crystal energy",
      "The storm below is deadly",
      "Airships are the primary form of travel",
    ],
    locations: [
      {
        name: "The Verdant Crown",
        description:
          "A lush island filled with giant trees, ruins, and hidden villages.",
        purpose:
          "The starting region where the player learns exploration and combat.",
        imagePrompt:
          "A lush floating fantasy island with giant trees, ancient ruins, waterfalls, and airships.",
      },
      {
        name: "The Iron Reach",
        description:
          "An industrial island controlled by engineers and heavily guarded machines.",
        purpose:
          "A major faction hub containing advanced equipment and difficult quests.",
        imagePrompt:
          "A floating industrial fantasy city filled with gears, towers, smoke, and glowing machinery.",
      },
    ],
    factions: [
      {
        name: "The Dawnkeepers",
        description:
          "Scholars who want to preserve ancient knowledge.",
        goal:
          "Restore the Skyforge and make its power available to everyone.",
        relationshipToPlayer:
          "They initially guide the player but hide important information.",
      },
      {
        name: "The Iron Dominion",
        description:
          "A military faction that believes strict control is necessary for survival.",
        goal:
          "Use the Skyforge to rule Aerath.",
        relationshipToPlayer:
          "They attempt to recruit the player and later become rivals.",
      },
    ],
    hazards: [
      "Storm creatures",
      "Collapsing islands",
      "Unstable machines",
      "Crystal storms",
    ],
    secrets: [
      "The Skyforge was originally built as a weapon",
      "Several islands are artificial",
      "The poisonous storm hides an ancient city",
    ],
    imagePrompt:
      "A vast fantasy world of floating islands, glowing ruins, airships, clouds, and a dangerous storm below.",
  },

  characters: [
    {
      name: "Kael Ardyn",
      role: "Player Character",
      age: "22",
      personality:
        "Curious, determined, compassionate, and occasionally reckless.",
      backstory:
        "Kael grew up salvaging ancient technology from abandoned ruins.",
      motivation:
        "Save the people of Aerath and discover the truth about their family.",
      abilities: [
        "Machine activation",
        "Sword combat",
        "Grappling hook traversal",
      ],
      appearance:
        "A young adventurer wearing a weathered coat, light armor, and a glowing mechanical gauntlet.",
      weapon: "Crystal-powered sword",
      relationshipToPlayer:
        "This is the main playable character.",
      imagePrompt:
        "Young fantasy adventurer with a glowing mechanical gauntlet, crystal sword, weathered coat, and light armor.",
    },
    {
      name: "Lyra Vale",
      role: "Mentor",
      age: "46",
      personality:
        "Intelligent, calm, secretive, and burdened by guilt.",
      backstory:
        "A former Skyforge engineer who survived the destruction of the old world.",
      motivation:
        "Correct the mistakes of the past.",
      abilities: [
        "Engineering",
        "Ancient language translation",
        "Energy manipulation",
      ],
      appearance:
        "A silver-haired engineer wearing layered robes and mechanical tools.",
      weapon: "Energy staff",
      relationshipToPlayer:
        "She guides the player but hides her connection to the disaster.",
      imagePrompt:
        "Silver-haired fantasy engineer wearing layered robes, mechanical tools, and carrying a glowing energy staff.",
    },
  ],

  enemies: [
    {
      name: "Storm Wraith",
      type: "Flying Creature",
      description:
        "A corrupted creature formed from storm energy.",
      behavior:
        "Circles the player from above before diving rapidly.",
      abilities: [
        "Lightning attack",
        "High-speed dive",
        "Temporary invisibility",
      ],
      weakness: "Crystal-powered ranged attacks",
      rewards: [
        "Storm essence",
        "Crafting materials",
      ],
      imagePrompt:
        "A ghostly flying creature made from clouds, lightning, and glowing blue energy.",
    },
    {
      name: "Iron Sentinel",
      type: "Ancient Machine",
      description:
        "A heavily armored machine that protects abandoned ruins.",
      behavior:
        "Patrols fixed routes and attacks anyone entering restricted areas.",
      abilities: [
        "Heavy melee strike",
        "Energy shield",
        "Ground shockwave",
      ],
      weakness: "Exposed energy core",
      rewards: [
        "Machine components",
        "Upgrade crystals",
      ],
      imagePrompt:
        "A massive ancient fantasy robot with stone armor, glowing runes, and a bright energy core.",
    },
  ],

  quests: [
    {
      title: "The Broken Key",
      type: "Main Quest",
      description:
        "Repair the damaged Skyforge key found inside an ancient temple.",
      objectives: [
        "Explore the ruined temple",
        "Recover three crystal fragments",
        "Defeat the temple guardian",
        "Repair the key",
      ],
      rewards: [
        "Skyforge Key",
        "New traversal ability",
        "Experience",
      ],
      failureCondition:
        "The player leaves the temple during its collapse.",
    },
    {
      title: "Wings of the Lost",
      type: "Side Quest",
      description:
        "Help an airship captain recover stolen engine parts.",
      objectives: [
        "Track the thieves",
        "Recover the engine parts",
        "Return to the captain",
      ],
      rewards: [
        "Airship upgrade",
        "Currency",
        "Faction reputation",
      ],
      failureCondition:
        "The stolen parts are destroyed.",
    },
  ],

  progression: {
    levelingSystem:
      "Players earn experience from combat, exploration, discoveries, and quests.",
    skills: [
      "Sword mastery",
      "Ranged combat",
      "Engineering",
      "Traversal",
      "Diplomacy",
    ],
    unlockableAbilities: [
      "Double jump",
      "Air dash",
      "Energy shield",
      "Machine override",
    ],
    equipment: [
      "Weapons",
      "Armor",
      "Mechanical tools",
      "Crystal accessories",
    ],
    currencies: [
      "Crowns",
      "Crystal shards",
      "Faction tokens",
    ],
    upgradeSystem:
      "Equipment and abilities are upgraded using materials gathered from enemies, ruins, and quests.",
  },

  artDirection: {
    visualStyle:
      "Stylized fantasy mixed with glowing ancient technology.",
    colorPalette: [
      "Deep violet",
      "Sky blue",
      "Emerald green",
      "Warm gold",
      "Storm gray",
    ],
    lightingStyle:
      "Bright natural lighting outdoors with dramatic glowing interiors.",
    characterStyle:
      "Stylized proportions with detailed clothing and recognizable silhouettes.",
    environmentStyle:
      "Large floating landscapes, ancient ruins, mechanical structures, and dramatic clouds.",
    interfaceStyle:
      "Clean futuristic fantasy interface with glowing crystal elements.",
    coverArtPrompt:
      "Epic fantasy game cover showing a young adventurer overlooking floating islands, airships, glowing ruins, and a giant storm.",
    logoPrompt:
      "Fantasy adventure game logo reading Echoes of the Skyforge, with glowing crystals, metal details, and cloud motifs.",
  },

  audioDirection: {
    musicStyle:
      "Orchestral fantasy music mixed with soft electronic textures.",
    ambience: [
      "Wind through floating islands",
      "Distant airship engines",
      "Bird calls",
      "Mechanical humming",
    ],
    characterVoiceDirection:
      "Natural and emotional performances with subtle regional accents.",
    combatSounds: [
      "Metal impacts",
      "Crystal energy blasts",
      "Machine movement",
      "Storm explosions",
    ],
    environmentSounds: [
      "Waterfalls",
      "Wind",
      "Creaking ruins",
      "Electrical machinery",
    ],
    victorySound:
      "A rising orchestral theme followed by a crystal chime.",
    failureSound:
      "A fading low note mixed with distant thunder.",
  },

  technicalPlan: {
    recommendedEngine: "Unreal Engine 5",
    cameraSystem:
      "Third-person follow camera with adjustable distance and collision handling.",
    requiredSystems: [
      "Character controller",
      "Combat system",
      "Quest system",
      "Dialogue system",
      "Inventory system",
      "Save system",
      "Faction reputation system",
    ],
    inputSystem:
      "Keyboard and mouse plus full controller support.",
    saveSystem:
      "Automatic checkpoints and manual save slots.",
    enemyAiRequirements: [
      "Patrolling",
      "Player detection",
      "Combat states",
      "Group behavior",
      "Returning to patrol areas",
    ],
    performanceTargets: [
      "60 FPS on recommended PC hardware",
      "30 FPS minimum on supported hardware",
      "Fast loading between islands",
    ],
    recommendedDevelopmentOrder: [
      "Player movement",
      "Basic combat",
      "Enemy AI",
      "Quest system",
      "World exploration",
      "Progression",
      "Story content",
      "Final polish",
    ],
  },

  roadmap: {
    prototype: [
      "Create basic movement",
      "Build one combat encounter",
      "Test floating-island traversal",
    ],
    verticalSlice: [
      "Complete one polished island",
      "Add one main quest",
      "Add two enemy types",
      "Implement basic progression",
    ],
    alpha: [
      "Build all major locations",
      "Add core story quests",
      "Complete main gameplay systems",
    ],
    beta: [
      "Balance combat",
      "Fix major bugs",
      "Optimize performance",
      "Test progression",
    ],
    finalPolish: [
      "Improve visuals",
      "Finish sound design",
      "Refine user interface",
      "Complete accessibility testing",
    ],
    majorRisks: [
      "World scope becoming too large",
      "Complex faction choices",
      "Performance issues with large environments",
      "Too many gameplay systems",
    ],
  },

  generatedAt: new Date().toISOString(),
};