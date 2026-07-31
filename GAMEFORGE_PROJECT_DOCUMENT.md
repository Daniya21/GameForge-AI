# GameForge AI — Project Document

## 1. Product purpose

GameForge AI is a game pre-production workspace that turns a concept into connected design material, a production plan, a team handoff package, and a final Game Design Document. It is designed to be simple enough for an exhibition visitor while remaining useful for a small production team.

## 2. Product principles

- One active game project at a time, with a library for switching between projects.
- One clear purpose per screen.
- No repeated summaries, progress panels, or export controls.
- The user remains the creative director and can edit all generated work.
- The final GDD is an output of completed work, not a separate design exercise.
- Core changes invalidate stale final documentation automatically.

## 3. Primary workflow

```text
Projects
  ↓
Design Studio
  ↓
Production
  ↓
Team Handoff
  ↓
Final GDD
```

## 4. Project Library

The Project Library supports:

- Creating a new project
- Opening and switching projects
- Duplicating a project
- Deleting a project
- Preserving each project's design and production data separately
- Migrating the previous single-project browser save into the new library

## 5. Design Studio

The Design Studio contains six specialist sections:

1. Story
2. Characters
3. World
4. Quests
5. Dialogue
6. AI Producer

Each tool is responsible for generating, editing, and saving one useful category of project information. GDD export is deliberately absent from this stage.

## 6. Dialogue Studio

Dialogue Studio follows a cinematic conversation-editor layout. It includes character context, NPC and player lines, branching choices, emotion, relationship impact, consequences, quality metrics, generation, editing, saving, and browser voice preview.

## 7. Production

Production converts design work into an actionable plan. It covers scope, feasibility, risks, roadmap, team requirements, audience assumptions, build priorities, and readiness for handoff.

## 8. Team Handoff

Team Handoff provides the practical collaboration layer: tasks, ownership, priorities, notes, feedback, status, and a concise delivery brief. It avoids duplicating the design tools.

## 9. Final GDD

The Final GDD page automatically compiles the active project's saved work. It supports:

- Automatic structured document generation
- Missing-section warnings
- Draft preview before full completion
- PDF export
- Word-compatible DOC export
- Markdown export
- JSON export
- Clipboard copy

When all six design sections are complete, the generated document is saved back to the project. Editing core design content or the project brief clears the stale saved GDD so a fresh version can be generated.

## 10. Optional experience

The interactive narrative prototype remains available as an optional demonstration of choices and consequences. It is not part of the required production workflow.

## 11. Honest scope

GameForge prepares the design and production foundation for a game. It does not claim to replace engineering, production art, animation, level construction, optimization, quality assurance, accessibility work, platform certification, or commercial release management.
