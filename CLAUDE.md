# Rushmore

Discord bot (discord.js v14, TypeScript) for a private friends server: Polymarket-style betting, Splitwise-style debts/reminders, emoji stats, and message classifiers that react to or relocate certain users' messages.

## Commands

```sh
npm run dev        # ts-node + nodemon, reads .env
npm run build      # tsc --noEmit (typecheck) + esbuild bundle → dist/index.js
npm run prettier   # format src/
node src/deploy-commands.js deploy   # re-register slash commands after changing them
npm run build:backfill        # bundle the emoji history backfill → dist/backfill-emojis.js
npm run build:seed            # bundle the game library seed → dist/seed-games.js (reads data/games-seed.json)
```

There are no tests. `npm run build` is the check: run it before calling a change done.

## Layout

- `src/index.ts`: client setup and event wiring only.
- `src/handlers/`: entry points per Discord event. `new-interaction.handler.ts` tries feature handlers first (`handleDebtsInteraction`, `handleEmojiInteraction`); each returns `true` if it handled the interaction. Add new features the same way instead of growing the big switch.
- `src/services/`: feature logic. `src/embeds/`, `src/modals/`: Discord UI builders.
- `src/components/`: API clients (`typesafeClient.ts`, the Jev classifier used by the football and work detectors).
- `src/database/sqlite.ts`: the only store. SQLite (`node:sqlite`, `data/rushmore.db`) holds betting (gamblers, forecasts, predictions), debts, reminders, emoji usage and the game library. Add new features by extending `SCHEMA` with `CREATE ... IF NOT EXISTS`.
- `src/scripts/`: one-off tools. `backfill-emojis.ts` is bundled and run on the phone; it resumes from a per-channel cursor.
- `src/deploy-commands.js`: the slash command definitions. Keep it in sync with the handlers.

## Conventions

- Prettier: 4 spaces, no semicolons, single quotes, es5 trailing commas.
- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` are on; handle `undefined` instead of using `!`.
- User-facing bot text is in Spanish; code, comments and logs are in English.
- Store money as integer cents.
- Config comes from env vars. Document every new one in `.env.example` with a comment, and give optional ones a default in code.
- Classifiers fail open: on API errors, do nothing to the message.
- Guard commands and buttons to guild interactions (`inCachedGuild()`).
- Never commit `.env`, `data/*.db`, `data/games-seed.json`, or exported message history (all gitignored). They contain real server data.

## Runtime and deploy

Runs in production on a Pixel 6 Pro under Termux (Node with `node:sqlite`). Only the bundled `dist/index.js` is shipped. See `docs/pixel-hosting.md` for deploy steps and `docs/troubleshooting.md` for known issues. Update those docs when the setup changes.

## Git

Short imperative commit subjects ("Add X", "Reject Y in Z"). Work on a feature branch and open a PR to `main`.
