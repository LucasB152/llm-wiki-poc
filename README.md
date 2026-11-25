# LLM Wiki POC

This project implements the **LLM Wiki** pattern described by Andrej Karpathy in his [LLM Wiki idea file](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f): instead of searching the raw documents at every question like classic RAG, the LLM builds a persistent wiki once and keeps it up to date.

An AI builds and maintains a **wiki** from your own documents, then answers questions using **only** that wiki.

You never write the wiki yourself:

1. **Add sources.** Upload raw documents (Markdown or text) from the web UI.
2. **Ingest.** The AI reads each source and writes structured, interlinked wiki pages, plus an index. Every ingestion and question is recorded in a log.
3. **Ask.** Ask questions. The AI answers from the wiki pages only and cites the pages it used. If the wiki does not contain the answer, it says so. Questions and answers are saved as conversations, so you can ask follow-up questions. You can also ask the AI to save an answer to the wiki or to fix a page.

The AI can be **Google Gemini**, **OpenAI**, **Anthropic** or **Groq** (free tier): you bring your own API key and choose the model.

> **Status:** personal proof of concept, **not maintained**. I built it to validate the approach before the development of a team project. There is no authentication: a single teacher manages the wiki from the web UI.

## Repository layout

```
.
├── docker-compose.yml   starts the database and the API
├── .env.example         configuration template, to copy to .env
├── llm_wiki_api/        NestJS API, see its README for details and the full list of routes
│   └── data/raw/        5 short sample sources in English about computer networking, to upload from the web UI
└── llm_wiki_webui/      Angular + Tailwind web UI, `pnpm start` → http://localhost:4200
```

| Component | Technology |
|---|---|
| API | NestJS (TypeScript), Vercel AI SDK |
| Front | Angular 22, Tailwind CSS 4 |
| Database | PostgreSQL 17 with Prisma 7: sources, wiki pages, AI instructions, log, conversations, API keys (encrypted) |
| Wiki | Markdown pages written by the AI, stored in the database |

## Running with Docker Compose

### 1. Requirements

- Docker with Docker Compose.
- An API key for Gemini, OpenAI, Anthropic or Groq, added later from the web UI.
- Node.js and pnpm, to run the web UI.
- Ports **3000** (API) and **5432** (PostgreSQL) must be free.

### 2. Configure

Copy the configuration template:

```bash
cp .env.example .env
```

Then fill in `.env`:

| Variable | Required | Description |
|---|---|---|
| `API_KEY_ENCRYPTION_KEY` | Yes | Encrypts the API keys stored in the database. Generate it with `openssl rand -base64 32`. |
| `CORS_ORIGINS` | No | Origins allowed to call the API, e.g. `http://localhost:5173`. Default: all origins. |

`.env` is not versioned: never commit it.

### 3. Start

```bash
docker compose up -d --build
```

Two services start, in this order:

| Service | Role |
|---|---|
| `db` | PostgreSQL database |
| `api` | Applies the database migrations, then serves the API on **http://localhost:3000** |

### 4. Try it

Start the web UI:

```bash
cd llm_wiki_webui
pnpm install
pnpm start
```

Then open **http://localhost:4200**:

1. **API Keys**: add your provider's key.
2. **Files → Sources**: upload sources, for example the samples of `llm_wiki_api/data/raw/`, then click **Ingest** on each one. An ingestion takes up to a minute.
3. **Wiki**: choose a provider and a model, then ask a question. The AI answers from the wiki only, and can also change a wiki page when you ask it to. To browse the pages or the sources, use the Files page: the AI refuses to list them or show them in full.

Every ingestion and question is recorded in **Files → Log**. The [API README](llm_wiki_api/README.md#api-reference) describes every route.

### 5. Stop

| Command | Effect |
|---|---|
| `docker compose stop` | Stops the containers. The data is kept, and `docker compose start` restarts them. |
| `docker compose down` | Deletes the containers. **All data is lost.** |

The project uses no Docker volume. Everything (sources, wiki pages, API keys, conversations, log) lives in the database of the `db` container, so it is lost when the containers are recreated: add your key and upload your sources again.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `set API_KEY_ENCRYPTION_KEY in .env` when starting | `.env` is missing or the variable is empty. Fill it in (see step 2). |
| `port is already allocated` | Port 3000 or 5432 is used by something else, for example the API or a database started locally. Stop it, then run `docker compose up -d` again. |

After changing `.env`, run `docker compose up -d` again: Compose recreates the containers that use the changed variables.

## Development

To work on the API without Docker (hot reload, tests...), see [Running locally](llm_wiki_api/README.md#running-locally) in the API README. Locally, the API reads the same `.env` file at the root of the repository.

The web UI calls the API on `http://localhost:3000` (see `llm_wiki_webui/src/app/core/api.ts`):

```bash
cd llm_wiki_webui
pnpm start   # http://localhost:4200, hot reload
pnpm test    # unit tests
pnpm build   # production build in dist/
```
