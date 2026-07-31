# GameForge AI — Simplified Production Studio

GameForge AI is a connected game pre-production workspace. Each game is stored as its own project and moves through one clear workflow:

**Project → Design Studio → Production → Team Handoff → Final GDD**

The redesign removes repeated dashboards, Living Bible screens, Scenario Lab screens, and premature GDD export controls. The final document is assembled automatically from the active project's saved work.

## Main workflow

1. **Projects** — create, open, duplicate, switch, or delete independent game projects.
2. **Design Studio** — complete Story, Characters, World, Quests, Dialogue, and AI Producer review.
3. **Production** — stays empty until real design content exists, then generates team size, roles, duration, workload, risks, and phases from that project.
4. **Team Handoff** — unlocks only after a current Production plan exists, then creates role-based tasks, ownership, notes, and approval status.
5. **Final GDD** — automatically compile the active project and export PDF, Word-compatible DOC, Markdown, or JSON.

Editing a core design section or the project brief invalidates an older GDD so the final document cannot silently become outdated.

## Primary routes

- `/` — product overview
- `/projects` — multi-project library
- `/design-studio` — six-tool design workflow
- `/story`, `/characters`, `/world`, `/quests`, `/dialogue`, `/mentor` — specialist tools
- `/production-intelligence` — production planning
- `/team-workspace` — team handoff
- `/gdd-export` — automatic final GDD builder
- `/playable-scene` — optional narrative prototype
- `/system-check` — local route checks

Legacy Living Bible and Scenario Lab URLs redirect into the simplified workflow.

## Run on Windows

Extract the ZIP into a clean folder. Open PowerShell in the folder containing `package.json`, then run:

```powershell
Copy-Item .env.example .env.local
npm.cmd install
npm.cmd run verify:experience
npm.cmd run verify:planb:final
npm.cmd run typecheck
npm.cmd run build
npm.cmd run dev
```

Open `http://localhost:3000`.

You can also double-click `START_GAMEFORGE.bat`. `VERIFY_GAMEFORGE.bat` checks the redesigned route and workflow files.

## Environment variables

Live AI generations use the provider configuration in `.env.local`:

```env
GROQ_API_KEY=
GROQ_FAST_MODEL=openai/gpt-oss-20b
GROQ_MODEL=

CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-1-schnell

ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
```

Successful AI results are saved to the project. The Dialogue Generator does not insert a fake sample when the provider is unavailable; it shows the real connection error instead. Never commit or share `.env.local`.

## Recommended demonstration

1. Open **Projects** and create or select a game.
2. Open **Design Studio** and show the six focused tools.
3. Open **Dialogue Generator**, enter the scene and cast, and generate the actual script.
4. Open **Production**. Confirm it is empty before content exists, then generate the plan from the current project.
5. Open **Team Handoff** and show the roles and tasks created from that Production plan.
6. Finish in **Final GDD** and export the automatically assembled document.
