# GameForge AI — Simplified Interactive Redesign

## Completed changes

- Added a persistent multi-project library with create, open, switch, duplicate, and delete actions.
- Preserved existing single-project browser data through automatic migration.
- Simplified Design Studio to six useful tools: Story, Characters, World, Quests, Dialogue, and AI Producer.
- Removed GDD Export from Design Studio.
- Rebuilt Dialogue Studio around the supplied visual direction with character context, branching responses, emotion, relationship tracking, consequences, metrics, and voice preview.
- Removed Living Bible and Scenario Lab from the active product flow.
- Reduced the main navigation to Home, Projects, Design Studio, Production, and Team Handoff.
- Added an automatic Final GDD stage after design and production work.
- Added PDF, Word-compatible DOC, Markdown, JSON, and clipboard outputs.
- Made changes to core project content invalidate stale generated GDD data.
- Updated route verification scripts and Windows launch helpers.

## Final workflow

```text
Preloader
  ↓
Projects
  ↓
Design Studio
  ├─ Story
  ├─ Characters
  ├─ World
  ├─ Quests
  ├─ Dialogue
  └─ AI Producer
  ↓
Production
  ↓
Team Handoff
  ↓
Automatic Final GDD
```

## Primary routes

- `/projects`
- `/design-studio`
- `/production-intelligence`
- `/team-workspace`
- `/gdd-export`
- `/dialogue`

Old `/game-project`, `/living-bible`, and `/scenario-lab` links redirect to the appropriate simplified pages.
