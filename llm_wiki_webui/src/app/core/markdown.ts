import { Marked } from 'marked';

/** Wiki page ("network-layer.md") or raw source ("../raw/03-network-layer.md") link. */
const WIKI_LINK = /^(\.\.\/raw\/)?([A-Za-z0-9_-][A-Za-z0-9._-]*\.md)$/;

const marked = new Marked({
  gfm: true,
  renderer: {
    // The AI cites pages with relative links: open them in the Files page instead.
    link({ href, tokens }) {
      const text = this.parser.parseInline(tokens);
      const wiki = WIKI_LINK.exec(href);
      if (wiki) {
        const param = wiki[1] ? 'source' : 'page';
        return `<a href="/files?${param}=${encodeURIComponent(wiki[2])}">${text}</a>`;
      }
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
  },
});

/**
 * Markdown to HTML. Bind the result with [innerHTML]: Angular sanitizes it
 * (scripts, event handlers and javascript: URLs are removed).
 */
export function renderMarkdown(markdown: string): string {
  return marked.parse(markdown, { async: false });
}
