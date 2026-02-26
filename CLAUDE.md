# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (Express + Vite middleware on port 3000)
npm run build    # Build frontend with Vite
npm run lint     # Type-check with tsc --noEmit
npm run clean    # Remove dist/
```

The app runs as a single Express server (`server.ts`) that serves both the API and the Vite dev middleware (or static `dist/` in production). There is no separate frontend dev server.

## Requirements

Node.js 22+ is required (`@vitejs/plugin-react` and `better-sqlite3` both require it). If using Homebrew: `brew install node@22` then add `/opt/homebrew/opt/node@22/bin` to your `PATH`. After switching Node versions, run `npm rebuild better-sqlite3` to recompile the native module.

## Architecture

**Dual storage model:** Every bookmark/highlight operation writes to two stores in parallel:
- **SQLite** (`voxread.db`) via the Express API — the "cloud" store, only used when online
- **IndexedDB** (`voxread_offline` database) via `src/services/db.ts` — always used, enables offline mode

`App.tsx` manages the online/offline state via `navigator.onLine` and `window` events, and routes reads/writes accordingly.

**API layer** (`src/services/api.ts`): thin fetch wrappers for `/api/bookmarks`, `/api/highlights`, and `/api/fetch-content` (a CORS proxy that returns raw HTML from external URLs).

**Server** (`server.ts`): Express app with SQLite (`better-sqlite3`). Auth is mocked — all requests use a hardcoded `MOCK_USER_ID = "user_123"`. DB schema is initialized inline at startup.

**Key components:**
- `Reader.tsx` — full-screen reading overlay, renders `bookmark.content` as Markdown via `react-markdown`, adjustable font size
- `VoiceHighlighter.tsx` — uses the Web Speech API (`SpeechRecognition`); listens for the phrase `"highlight [text]"` to create a highlight
- `BookmarkCard.tsx` — card in the library grid

**Path alias:** `@` resolves to the project root (not `src/`).

**Styling:** Tailwind CSS v4 via `@tailwindcss/vite` plugin. Animations use `motion/react` (Motion library).
