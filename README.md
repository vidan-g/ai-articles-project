# Daily AI Research Digest

An automated AI intelligence platform and TypeScript web application that curates, deduplicates, and presents the **5 most important AI stories from the last 24 hours** across **OpenAI, Anthropic, Google, Apple, Meta, and Microsoft**.

Instead of relying on your computer being turned on at a fixed clock time, the application runs an **Auto-On-Wake Scanner** ([`src/scanner.ts`](./src/scanner.ts)): whenever the server starts, wakes up, or receives a visit on `http://localhost:3000`, it checks if today's briefing (`YYYY-MM-DD`) already exists in [`AI_DIGEST.md`](./AI_DIGEST.md) and automatically scans live primary AI feeds if today's edition is missing.

---

## Key Features

- **Auto-On-Wake Live Scanner (`src/scanner.ts`)** — Automatically checks on startup, every 15 minutes while your Mac is awake, and on dashboard visits whether today's digest exists. Fetches primary RSS/Atom feeds and Hacker News AI frontpage APIs, scores stories by significance, filters out duplicates, and prepends today's top 5 briefing.
- **Structured Markdown Parser (`src/parser.ts`)** — Parses rolling [`AI_DIGEST.md`](./AI_DIGEST.md) briefings into strongly typed TypeScript models and automatically tags stories by organization (`OpenAI`, `Anthropic`, `Google`, `Apple`, `Meta`, `Microsoft`).
- **Deduplication Engine (`src/digestManager.ts`)** — Prevents repetitive news across consecutive days using Jaccard token similarity on headlines and canonical source URL matching.
- **Interactive Web Dashboard & REST API (`src/server.ts`, `src/ui.ts`)** — Serves a responsive dark-mode web UI with a **"↻ Scan New Articles"** button, instant search, and company filter chips alongside JSON API endpoints.
- **CLI & Static Site Exporter (`src/cli.ts`)** — Trigger a live scan, inspect digest statistics, filter stories from the terminal, test candidate headlines for duplicates, or export a standalone static HTML dashboard (`docs/index.html`).

---

## Quick Start

```bash
# Install dependencies
npm install

# Run the interactive web server with auto-on-wake scanning (http://localhost:3000)
npm run dev

# Trigger an on-demand scan from the terminal
npm run scan

# Build TypeScript to dist/
npm run build

# Run the automated test suite (Vitest)
npm test
```

---

## CLI Usage

```bash
# Scan live feeds if today's briefing is missing (or force a fresh scan)
npm run scan
npm run scan:force

# View aggregate digest statistics by company
npm run cli -- stats

# List stories filtered by company or keyword
npm run cli -- list --company=Google
npm run cli -- list --q=agent

# Check if a candidate headline is a duplicate of a recent story
npm run cli -- check-duplicate "Google DeepMind Expands Gemini 4 Frontier Lineup"

# Export a standalone static HTML dashboard to docs/index.html
npm run export:html
```

---

## REST API Endpoints

| Endpoint | Description |
| :--- | :--- |
| `GET /` | Interactive web dashboard with on-demand scan button, search, and company filter chips |
| `POST /api/scan` | Trigger a live scan (`?force=true` to force refresh today's briefing) |
| `GET /api/digests` | Full list of daily briefings and stories |
| `GET /api/stories?company=OpenAI&q=agent` | Filter stories across all days by company, keyword (`q`), or `date` |
| `GET /api/stats` | Total briefings, total stories, and story counts per AI lab |
| `GET /api/check-duplicate?title=...` | Check whether a candidate story title or URL already exists |
| `GET /health` | Health check endpoint (`{ "status": "ok", "today": "YYYY-MM-DD" }`) |

---

## Project Structure

```text
├── AI_DIGEST.md               # Rolling Markdown archive of daily top-5 AI briefings
├── docs/
│   └── index.html             # Exported static web dashboard
├── src/
│   ├── types.ts               # TypeScript interfaces and tracked company constants
│   ├── parser.ts              # Markdown parser, formatter, and company tag extractor
│   ├── digestManager.ts       # Deduplication engine, filtering, stats, and file repository
│   ├── scanner.ts             # Live RSS/API AI news scanner and importance scorer
│   ├── ui.ts                  # Responsive HTML dashboard renderer
│   ├── server.ts              # HTTP server, auto-on-wake loop, and JSON API
│   └── cli.ts                 # Command-line interface & static HTML exporter
└── tests/
    ├── digest.test.ts         # Unit tests for parser, deduplication, and prepending
    ├── scanner.test.ts        # Unit tests for live feed parser, scoring, and top-5 selection
    └── server.test.ts         # Integration tests for HTTP server and REST API
```
