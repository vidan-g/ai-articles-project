# Daily AI Research Digest

An automated AI intelligence platform and TypeScript web application that curates, deduplicates, and presents the **5 most important AI stories from the last 24 hours** across **OpenAI, Anthropic, Google, Apple, Meta, and Microsoft**.

Every morning at **9:00 AM**, a scheduled research agent searches primary sources, checks the rolling archive ([`AI_DIGEST.md`](./AI_DIGEST.md)) to prevent duplicate stories, and prepends a structured briefing with summaries, impact analysis (*Why It Matters*), and original source links.

---

## Key Features

- **Structured Markdown Parser (`src/parser.ts`)** — Parses rolling [`AI_DIGEST.md`](./AI_DIGEST.md) briefings into strongly typed TypeScript models and automatically tags stories by organization (`OpenAI`, `Anthropic`, `Google`, `Apple`, `Meta`, `Microsoft`).
- **Deduplication Engine (`src/digestManager.ts`)** — Prevents repetitive news across consecutive days using Jaccard token similarity on headlines and canonical source URL matching.
- **Interactive Web Dashboard & REST API (`src/server.ts`, `src/ui.ts`)** — Serves a responsive dark-mode web UI with instant search and company filter chips alongside JSON API endpoints.
- **CLI & Static Site Exporter (`src/cli.ts`)** — Inspect digest statistics, filter stories from the terminal, test candidate headlines for duplicates, or export a standalone static HTML dashboard (`docs/index.html`).

---

## Quick Start

```bash
# Install dependencies
npm install

# Run the interactive web server (http://localhost:3000)
npm run dev

# Build TypeScript to dist/
npm run build

# Run the automated test suite (Vitest)
npm test
```

---

## CLI Usage

```bash
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
| `GET /` | Interactive web dashboard with search and company filter chips |
| `GET /api/digests` | Full list of daily briefings and stories |
| `GET /api/stories?company=OpenAI&q=agent` | Filter stories across all days by company, keyword (`q`), or `date` |
| `GET /api/stats` | Total briefings, total stories, and story counts per AI lab |
| `GET /api/check-duplicate?title=...` | Check whether a candidate story title or URL already exists |
| `GET /health` | Health check endpoint (`{ "status": "ok" }`) |

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
│   ├── ui.ts                  # Responsive HTML dashboard renderer
│   ├── server.ts              # HTTP server & JSON API
│   └── cli.ts                 # Command-line interface & static HTML exporter
└── tests/
    ├── digest.test.ts         # Unit tests for parser, deduplication, and prepending
    └── server.test.ts         # Integration tests for HTTP server and REST API
```
