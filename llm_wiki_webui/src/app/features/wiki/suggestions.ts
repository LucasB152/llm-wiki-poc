/** Title of a wiki page: its first "# " heading, else the file name ("tcp-vs-udp.md" → "tcp vs udp"). */
export function pageTitle(content: string, fileName: string): string {
  const heading = /^#\s+(.+)$/m.exec(content)?.[1].trim();
  return heading || fileName.replace(/\.md$/, '').replace(/-/g, ' ');
}

/** Turns a page title into a question whose answer is that page. */
export function questionFor(title: string): string {
  const vs = /^(.+?)\s+vs\.?\s+(.+)$/i.exec(title);
  if (vs) return `What is the difference between ${vs[1]} and ${vs[2]}?`;
  // Lowercase the first letter, except for acronyms ("TCP", "IPv4").
  const subject = /^[A-Z][a-z]/.test(title) ? title[0].toLowerCase() + title.slice(1) : title;
  return `What is ${subject}?`;
}

/** Picks `count` distinct items at random (Fisher-Yates shuffle on a copy). */
export function pickRandom<T>(items: T[], count: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}
