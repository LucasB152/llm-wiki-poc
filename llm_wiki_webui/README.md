# LLM Wiki web UI

Web interface of the LLM Wiki POC, for the teacher who manages the wiki. It talks to the NestJS API of [`../llm_wiki_api`](../llm_wiki_api/README.md). There is no authentication.

Built with Angular 22 (standalone components, signals) and Tailwind CSS 4.

## Pages

| Route | Page | What it does |
|---|---|---|
| `/` | Home | Presentation of the project |
| `/wiki` | Wiki | Chat with the AI: questions answered from the wiki only, conversations, model choice, "Save to wiki" |
| `/files` | Files | Sources (upload, edit, delete, ingest), wiki pages (read only), AI instructions (`AGENTS.md`), log |
| `/api-keys` | API Keys | Add or delete the key of each provider (Groq, Gemini, Anthropic, OpenAI) |

## Running

The API must be running on `http://localhost:3000` (see the [project README](../README.md#running-with-docker-compose)). The URL is set in [`src/app/core/api.ts`](src/app/core/api.ts).

```bash
pnpm install
pnpm start   # http://localhost:4200, hot reload
pnpm test    # unit tests (Vitest)
pnpm build   # production build in dist/llm_wiki_webui/
```

## Project structure

```
src/app/
  app.ts / app.html      shell: navigation, main area, footer
  app.routes.ts          lazy-loaded routes
  core/                  API URL, API error messages, Markdown rendering
  features/
    home/                home page
    wiki/                chat, conversations, question suggestions
    files/               sources, wiki pages, AI instructions, log
    llm/                 API keys and the provider/model picker
```

Each feature holds its page component and the service that calls its API routes.
