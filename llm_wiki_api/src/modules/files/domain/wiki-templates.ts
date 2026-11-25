/**
 * Default contents written on first startup, only if the files do not exist yet
 * (existing changes are never overwritten).
 */

export const DEFAULT_SCHEMA = `# AGENTS.md — Wiki schema

This is an **LLM Wiki**: a markdown knowledge base, written and maintained by an
LLM from raw sources.

## Layout

\`\`\`
AGENTS.md      this file: conventions and workflows (co-written by the human and the LLM)
raw/           raw sources, IMMUTABLE for the LLM: it reads them but never modifies them
wiki/          pages written and maintained by the LLM
  index.md     catalog of every page, by category
\`\`\`

## Language

Write every wiki page in **English**, whatever the language of the source.

## Page types

- **Concept**: a notion, a technique, a protocol, a device…
  (e.g. \`optical-fiber.md\`, \`manchester-encoding.md\`). The core of the wiki:
  one page per concept, enriched by EVERY source that mentions it.
- **Overview**: the big picture of a topic (e.g. \`physical-layer.md\`). Short
  (15 to 30 lines): it frames the topic, sums up the essentials and links to the
  concept pages instead of detailing them.
- **Comparison**: when several concepts are alike (e.g. \`tcp-vs-udp.md\`).

## Rules

- Never modify or delete a file in \`raw/\`.
- **Never copy a source or reuse its outline.** The wiki reorganizes the
  information by concept; one source usually feeds several pages.
- Before creating a page, check that there is no page on the same topic yet:
  enrich the existing one rather than creating a near-duplicate.
- Page names: lowercase, words separated by hyphens, \`.md\` extension
  (e.g. \`network-layer.md\`). No subfolders.
- Every page starts with a \`# ...\` title and a one or two sentence summary.
- Link pages together with relative markdown links
  (\`[Optical fiber](optical-fiber.md)\`): every page links to at least one other
  page and is linked from at least one page. End every page with a
  \`## See also\` section.
- Cite sources **once per section**, at the end of the section, not after every
  sentence (\`Sources: [03-network-layer.md](../raw/03-network-layer.md)\`).
- Flag contradictions between sources explicitly instead of silently picking one.

## Workflows

### Ingesting a source
1. Read the new source in \`raw/\` and list its key concepts (usually 3 to 10).
2. For each concept: enrich its page if it has one, otherwise create it.
3. Create or update the short overview page of the topic, linking to the concept pages.
4. Add links to the new pages in the existing pages they relate to.
5. Update \`index.md\`.

### Question
1. Read \`index.md\` to find the relevant pages, then read them.
2. Answer by citing the pages. If the answer has lasting value, save it as a
   new page and add it to the index.

### Review (lint)
Look for contradictions, outdated claims, orphan pages (no incoming link),
concepts mentioned without a page of their own, and broken links.
`;

export const DEFAULT_INDEX = `# Index

Catalog of the wiki pages, grouped by category.
Each entry: link to the page and a one-line summary.

_No pages yet._
`;
