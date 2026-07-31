"use client";

import type { GameProject, StoredDesignResult } from "@/app/types/game-project";
import { createEmptyGameProject, writeActiveGameProject } from "@/lib/game-project/client";

function stored<T>(id: string, input: Record<string, unknown>, result: T, timestamp: string): StoredDesignResult<T> {
  return {
    id,
    input,
    result,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createJudgeDemoProject(): GameProject {
  const project = createEmptyGameProject("Vault of Echoes");
  const timestamp = new Date().toISOString();

  return {
    ...project,
    title: "Vault of Echoes",
    summary:
      "Four specialists prepare to rob Meridian Crown Bank while a hidden police operation turns trust, timing, and loyalty into the real game system.",
    genre: "Narrative Stealth Thriller",
    platform: "PC & Web",
    audience: "Teen / Young Adult",
    updatedAt: timestamp,
    designStudio: {
      ...project.designStudio,
      story: stored(
        "demo-story",
        { premise: "Four robbers plan a high-stakes bank heist.", genre: "Mystery", tone: "Dark" },
        {
          title: "Vault of Echoes — Narrative Blueprint",
          sections: [
            { title: "Premise", content: "Four specialists infiltrate Meridian Crown Bank during a citywide blackout, but the crew leader is secretly feeding evidence to a police task force." },
            { title: "Player Role", content: "The player is Nara Vale, the crew's systems expert, balancing the heist plan against a growing suspicion that the team has been compromised." },
            { title: "Act I", content: "Recruit the crew, study the bank, and choose which insider to trust." },
            { title: "Act II", content: "Execute the robbery while evidence reveals that someone is redirecting the operation." },
            { title: "Act III", content: "Decide whether to expose the leader, complete the heist, or turn the vault into a trap for both police and criminals." },
            { title: "Endings", content: "Loyalty, suspicion, and evidence produce three outcomes: Clean Escape, Broken Crew, or Double Cross." },
          ],
        },
        timestamp,
      ),
      characters: [
        stored(
          "demo-characters",
          { roster: "Four-person heist crew" },
          {
            title: "Character Bible",
            sections: [
              { title: "Nara Vale — Player", content: "Systems expert. Precise, observant, and emotionally tied to the crew. Wants the money but fears becoming the kind of person she once hunted." },
              { title: "Marcus Venn — Leader", content: "Charismatic planner and covert police asset. His secret creates the project's central tension." },
              { title: "Ilya Cross — Driver", content: "Risk-taking wheelman who trusts Marcus completely and clashes with Nara's caution." },
              { title: "Sana Kade — Insider", content: "Bank security analyst whose loyalty changes according to how the player handles pressure." },
            ],
          },
          timestamp,
        ),
      ],
      world: stored(
        "demo-world",
        { setting: "Stylized near-future financial district" },
        {
          title: "World Bible",
          sections: [
            { title: "Meridian Crown Bank", content: "A layered heist space with public atrium, operations floor, security spine, private archive, and subterranean vault." },
            { title: "Safehouse", content: "The planning hub where relationships, equipment, and the final approach are decided." },
            { title: "Financial District", content: "Rain-soaked streets, elevated transit, service tunnels, and police response routes create multiple escape possibilities." },
            { title: "World Rule", content: "Every location exposes both a tactical route and a social consequence." },
          ],
        },
        timestamp,
      ),
      quests: [
        stored(
          "demo-quests",
          { goal: "A connected bank-heist quest chain" },
          {
            title: "Quest Architecture",
            sections: [
              { title: "Mission 1 — Glass Floor", content: "Enter the bank during business hours, map camera blind spots, and choose whether to protect Sana's identity." },
              { title: "Mission 2 — Blackout Protocol", content: "Steal a power-routing key while avoiding a confrontation with Ilya." },
              { title: "Mission 3 — The Silent Vault", content: "Execute the heist. Earlier trust decisions alter access, patrols, and available exits." },
              { title: "Mission 4 — Echoes", content: "Investigate Marcus or continue the plan. The decision determines the final objective and ending." },
            ],
          },
          timestamp,
        ),
      ],
      dialogue: [
        stored(
          "demo-dialogue",
          { scene: "Night before the heist" },
          {
            title: "Dialogue Scene — The Night Before",
            sections: [
              { title: "Marcus", content: "Tomorrow, nobody improvises. We walk in as four people and leave as one decision." },
              { title: "Nara", content: "Then stop changing the plan when you think nobody is watching." },
              { title: "Choice A", content: "Trust Marcus. Loyalty +15, Suspicion -10." },
              { title: "Choice B", content: "Confront him privately. Evidence +20, Crew Stability -10." },
              { title: "Choice C", content: "Warn Sana. New quest unlocked: Hidden Channel." },
            ],
          },
          timestamp,
        ),
      ],
      mentor: stored(
        "demo-mentor",
        { challenge: "Make the concept feasible and judge-ready" },
        {
          title: "AI Producer Review",
          sections: [
            { title: "Verdict", content: "Strong exhibition concept because one narrative change visibly updates multiple design systems." },
            { title: "Priority", content: "Demonstrate connected intelligence, not content volume." },
            { title: "Risk", content: "Avoid relying on live 3D generation during the presentation." },
          ],
        },
        timestamp,
      ),
      gdd: stored(
        "demo-gdd",
        { format: "Executive game design document" },
        {
          title: "Vault of Echoes — Production GDD",
          sections: [
            { title: "Product Vision", content: "A stylized 3D narrative stealth thriller where social trust directly changes mission structure." },
            { title: "Core Pillars", content: "Plan under uncertainty; read the crew; execute adaptable missions; own the consequences." },
            { title: "Target Scope", content: "A polished 20-minute vertical slice built around one heist, four characters, three major choices, and three endings." },
          ],
        },
        timestamp,
      ),
      blueprint: null,
    },
    build: {
      ...project.build,
      status: "ready",
      warning: "Pre-production presentation mode: planning and design intelligence only.",
      provider: "GameForge Design Intelligence",
      updatedAt: timestamp,
    },
  };
}

export function loadJudgeDemoProject() {
  return writeActiveGameProject(createJudgeDemoProject());
}
