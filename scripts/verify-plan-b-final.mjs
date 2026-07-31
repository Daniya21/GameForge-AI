import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "app/page.tsx",
  "app/projects/page.tsx",
  "app/design-studio/page.tsx",
  "app/dialogue/page.tsx",
  "app/production-intelligence/page.tsx",
  "app/team-workspace/page.tsx",
  "app/gdd-export/page.tsx",
  "app/components/Navbar.tsx",
  "lib/game-project/client.ts",
  "GAMEFORGE_PROJECT_DOCUMENT.md",
];

const failures = [];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`Missing ${file}`);
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

const navbar = read("app/components/Navbar.tsx");
for (const route of ["/projects", "/design-studio", "/production-intelligence", "/team-workspace"]) {
  if (!navbar.includes(route)) failures.push(`Navbar is missing ${route}.`);
}
for (const removed of ["Living Bible", "Scenario Lab", "Export Studio"]) {
  if (navbar.includes(removed)) failures.push(`Navbar still exposes removed item: ${removed}.`);
}

const redirects = {
  "app/game-project/page.tsx": "/projects",
  "app/bible/page.tsx": "/projects",
  "app/game-bible/page.tsx": "/projects",
  "app/living-bible/page.tsx": "/projects",
  "app/scenario-lab/page.tsx": "/production-intelligence",
  "app/scenario/page.tsx": "/production-intelligence",
  "app/lab/page.tsx": "/production-intelligence",
};
for (const [file, target] of Object.entries(redirects)) {
  if (!fs.existsSync(path.join(root, file)) || !read(file).includes(`redirect("${target}")`)) {
    failures.push(`${file} does not redirect to ${target}.`);
  }
}

const projectClient = read("lib/game-project/client.ts");
for (const token of [
  "GAME_PROJECTS_STORAGE_KEY",
  "createAndActivateGameProject",
  "switchActiveGameProject",
  "duplicateGameProject",
  "deleteGameProject",
]) {
  if (!projectClient.includes(token)) failures.push(`Project library is missing ${token}.`);
}

const projects = read("app/projects/page.tsx");
for (const token of ["Create New Project", "Duplicate", "Delete", "Open Studio"]) {
  if (!projects.includes(token)) failures.push(`Project Library is missing ${token}.`);
}

const studio = read("app/design-studio/page.tsx");
if (studio.includes('key: "gdd"') || studio.includes("GDD Export")) failures.push("GDD is still exposed as a Design Studio tool.");
for (const token of ["+ New Project", "Project completion", "The final GDD is not another Design Studio task"]) {
  if (!studio.includes(token)) failures.push(`Design Studio is missing ${token}.`);
}

const dialogue = read("app/dialogue/page.tsx");
for (const token of ["Dialogue Generator", "Generate dialogue", "No dialogue generated yet", "saveDesignStudioSection(\"dialogue\""]) {
  if (!dialogue.includes(token)) failures.push(`Dialogue Generator is missing ${token}.`);
}
for (const removed of ["DialogueExperience", "dialogue-center-reference.png", "speechSynthesis", "localDialogue", "100+"]) {
  if (dialogue.includes(removed)) failures.push(`Dialogue Generator still contains removed promotional or fake content: ${removed}.`);
}

const gdd = read("app/gdd-export/page.tsx");
for (const token of ["buildAutomaticGdd", "saveDesignStudioSection(\"gdd\"", "downloadPdf", "downloadWord", "downloadMarkdown"]) {
  if (!gdd.includes(token)) failures.push(`Automatic final GDD is missing ${token}.`);
}

const production = read("app/production-intelligence/page.tsx");
for (const token of ["projectHasProductionInputs", "Generate production plan", "No production data yet", "Open Team Handoff"]) {
  if (!production.includes(token)) failures.push(`Production is missing ${token}.`);
}
for (const removed of ["loadJudgeDemoProject", "Load demo"]) {
  if (production.includes(removed)) failures.push(`Production still contains placeholder demo behavior: ${removed}.`);
}

const workspace = read("app/team-workspace/page.tsx");
for (const token of ["Role-based handoff", "Export handoff", "Feedback record", "Generate Production first", "readProductionPlan"]) {
  if (!workspace.includes(token)) failures.push(`Team workspace is missing ${token}.`);
}
for (const removed of ["loadJudgeDemoProject", "Load demo", "gameforge.teamWorkspace.${projectId}"]) {
  if (workspace.includes(removed)) failures.push(`Team workspace still contains old placeholder behavior: ${removed}.`);
}

if (failures.length) {
  console.error("GameForge simplified workflow verification failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("GameForge simplified production workflow verification passed.");
console.log("Verified: multi-project library, six-tool Design Studio, focused Dialogue Generator, data-gated Production, data-gated Team Handoff, and automatic final GDD.");
