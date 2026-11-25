import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { FilesService, WikiArea } from '../../files';
import { LIMITS } from '../domain/limits';

/** What the AI read / wrote during a run, reported in the response. */
export interface WikiActivity {
  pagesRead: Set<string>;
  sourcesRead: Set<string>;
  pagesCreated: Set<string>;
  pagesUpdated: Set<string>;
}

export const newActivity = (): WikiActivity => ({
  pagesRead: new Set(),
  sourcesRead: new Set(),
  pagesCreated: new Set(),
  pagesUpdated: new Set(),
});

/** Page name allowed for writing: lowercase, hyphens, .md extension. */
const PAGE_NAME = /^[a-z0-9][a-z0-9-]*\.md$/;

/**
 * Errors are returned to the AI as a result (instead of being thrown)
 * so it can fix its call (unknown page name, etc.).
 */
async function safely<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** Read tools, shared by ingestion and queries. */
function readTools(filesService: FilesService, activity: WikiActivity) {
  return {
    list_pages: tool({
      description: 'Lists the names of all the wiki pages (wiki/ folder).',
      inputSchema: z.object({}),
      execute: () => safely(() => filesService.findAll(WikiArea.WIKI)),
    }),
    read_page: tool({
      description: 'Reads the full markdown content of a wiki page.',
      inputSchema: z.object({
        name: z.string().describe('File name, e.g. "network-layer.md"'),
      }),
      execute: ({ name }) =>
        safely(async () => {
          const { content } = await filesService.findOne(WikiArea.WIKI, name);
          activity.pagesRead.add(name);
          return { name, content };
        }),
    }),
    list_sources: tool({
      description: 'Lists the names of the raw sources (raw/ folder).',
      inputSchema: z.object({}),
      execute: () => safely(() => filesService.findAll(WikiArea.RAW)),
    }),
    read_source: tool({
      description: 'Reads a raw source from raw/ (read-only).',
      inputSchema: z.object({ name: z.string() }),
      execute: ({ name }) =>
        safely(async () => {
          const { content } = await filesService.findOne(WikiArea.RAW, name);
          activity.sourcesRead.add(name);
          // A huge source would fill the context of every following step.
          return content.length > LIMITS.sourceChars
            ? {
                name,
                content: content.slice(0, LIMITS.sourceChars),
                truncated: true,
              }
            : { name, content };
        }),
    }),
  };
}

/** Writes a wiki page (never raw/ or AGENTS.md), with the name and size checks. */
function writePageTool(filesService: FilesService, activity: WikiActivity) {
  return tool({
    description:
      'Creates or fully replaces a wiki page (index.md included). ' +
      'The given content replaces the whole file: to change an existing page, ' +
      'read it first, then send back the complete updated version.',
    inputSchema: z.object({
      name: z
        .string()
        .describe(
          'Lowercase and hyphens, .md extension, e.g. "network-layer.md"',
        ),
      content: z.string().describe('Full markdown content of the page'),
    }),
    execute: ({ name, content }) =>
      safely(async () => {
        if (!PAGE_NAME.test(name)) {
          throw new Error(
            `Invalid name "${name}": lowercase letters, digits and hyphens only, .md extension.`,
          );
        }
        if (content.length > LIMITS.pageChars) {
          throw new Error(
            `Page too long (${content.length} characters, max ${LIMITS.pageChars}): ` +
              'split it into several concept pages linked together.',
          );
        }
        const { created } = await filesService.writeWikiPage(name, content);
        if (created) activity.pagesCreated.add(name);
        else if (!activity.pagesCreated.has(name))
          activity.pagesUpdated.add(name);
        return { name, status: created ? 'created' : 'updated' };
      }),
  });
}

/**
 * Tools for the chat: read, plus write_page, which the prompt only allows when
 * the teacher explicitly asks for a change ("save this answer", "fix this page").
 */
export function createQueryTools(
  filesService: FilesService,
  activity: WikiActivity,
): ToolSet {
  return {
    ...readTools(filesService, activity),
    write_page: writePageTool(filesService, activity),
  };
}

/** Tools for ingestion: read + write wiki pages. */
export function createIngestTools(
  filesService: FilesService,
  activity: WikiActivity,
): ToolSet {
  return {
    ...readTools(filesService, activity),
    write_page: writePageTool(filesService, activity),
  };
}
