# VoxRead

A local-first reading app that syncs across devices on your LAN — no cloud required.

Save articles, highlights, and reading progress. Everything lives in a SQLite database on each device and syncs automatically with other VoxRead instances on your network via mDNS and CRDTs.

## Features

- **Save articles** from any URL — content is extracted server-side and stored locally
- **Offline reading** — all bookmarks are mirrored to IndexedDB so the app works without a connection
- **LAN sync** — devices discover each other via mDNS (Bonjour) and sync changes using [cr-sqlite](https://github.com/vlcn-io/cr-sqlite) CRDTs (last-write-wins per column, no manual conflict resolution)
- **Voice highlights** — say "highlight [text]" while reading to create a highlight via the Web Speech API
- **Adjustable reader** — font size controls, clean Markdown rendering

## Running

### Local development

Requires Node.js 22+. If using Homebrew: `brew install node@22`.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Docker

```bash
docker compose up
```

The database is persisted in a named Docker volume (`voxread-data`).

**mDNS note:** On Linux, uncomment `network_mode: host` in `docker-compose.yml` for automatic LAN peer discovery. On macOS Docker Desktop, host networking is not supported — the app works on `localhost:3000` but peers won't be discovered automatically.

## LAN Sync

Each device running VoxRead on the same network discovers the others automatically and syncs in the background. No configuration needed.

To run a second instance locally (e.g. for testing):

```bash
PORT=3001 npm run dev
```

To give a device a custom name shown in the peers dropdown:

```bash
DEVICE_NAME="MacBook" npm run dev
```

### How it works

1. Each instance advertises itself via mDNS (`_voxread._tcp`)
2. On discovery, a pull-then-push sync runs immediately
3. Every write fans out to all known peers
4. A heartbeat every 8s evicts unreachable peers
5. On restart, the node catches up from any peers already online

Conflict resolution uses cr-sqlite: concurrent edits to different columns both survive; same-column conflicts resolve by Lamport clock.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `DATA_DIR` | `.` | Directory for the SQLite database |
| `DEVICE_NAME` | auto-generated | Name shown to peers in the sync UI |

## Scripts

```bash
npm run dev      # Start dev server (Express + Vite)
npm run build    # Build frontend for production
npm run lint     # Type-check
npm run clean    # Remove dist/
```
