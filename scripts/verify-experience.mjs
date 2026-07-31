import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "app/page.tsx",
  "app/projects/page.tsx",
  "app/design-studio/page.tsx",
  "app/production-intelligence/page.tsx",
  "app/team-workspace/page.tsx",
  "app/gdd-export/page.tsx",
  "app/dialogue/page.tsx",
  "app/error.tsx",
  "app/not-found.tsx",
  "app/components/home/InteractiveForgeHero.tsx",
  "lib/game-project/client.ts",
  "public/gameforge-hero-bg.png",
  "public/dialogue-center-reference.png",
  "public/cards/story.png",
  "public/cards/characters.png",
  "public/cards/world.png",
  "public/cards/quests.png",
  "public/cards/dialogue.svg",
  "public/cards/ai-mentor.png",
];

const missing = required.filter((item) => !fs.existsSync(path.join(root, item)));
if (missing.length) {
  console.error("Missing required experience files:\n" + missing.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

const navbar = fs.readFileSync(path.join(root, "app/components/Navbar.tsx"), "utf8");
const home = fs.readFileSync(path.join(root, "app/page.tsx"), "utf8");
const studio = fs.readFileSync(path.join(root, "app/design-studio/page.tsx"), "utf8");
const projects = fs.readFileSync(path.join(root, "app/projects/page.tsx"), "utf8");
const dialogue = fs.readFileSync(path.join(root, "app/dialogue/page.tsx"), "utf8");
const gdd = fs.readFileSync(path.join(root, "app/gdd-export/page.tsx"), "utf8");

const checks = [
  [!navbar.includes("Living Bible") && !navbar.includes("Scenario Lab") && !navbar.includes("Export Studio"), "Removed navigation items must stay removed"],
  [navbar.includes("/projects") && navbar.includes("/design-studio") && navbar.includes("/production-intelligence") && navbar.includes("/team-workspace"), "Simplified navigation routes must be connected"],
  [home.includes("InteractiveForgeHero"), "Interactive home hero must be installed"],
  [studio.includes("+ New Project") && studio.includes("tools.map"), "Simplified Design Studio and New Project control must be installed"],
  [projects.includes("duplicateGameProject") && projects.includes("deleteGameProject"), "Project management actions must be installed"],
  [dialogue.includes("Dialogue Generator") && dialogue.includes("Generate dialogue"), "Focused dialogue generator must be installed"],
  [!dialogue.includes("DialogueExperience") && !dialogue.includes("localDialogue") && !dialogue.includes("speechSynthesis"), "Promotional dialogue demo and fake fallback must stay removed"],
  [gdd.includes("buildAutomaticGdd") && gdd.includes("downloadPdf"), "Automatic final GDD and PDF export must be installed"],
];

const failed = checks.filter(([passed]) => !passed);
if (failed.length) {
  console.error("Experience verification failed:\n" + failed.map(([, message]) => `- ${message}`).join("\n"));
  process.exit(1);
}

console.log("GameForge simplified interactive experience verification passed.");
console.log("Verified: project library, clean Design Studio, focused Dialogue Generator, automatic final GDD, and recovery pages.");
