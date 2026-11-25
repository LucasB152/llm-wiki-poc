/**
 * Guards against runaway token usage. Every AI step resends the whole
 * conversation (instructions, source, previous tool results), so the cost of an
 * operation grows faster than its number of steps.
 */
export const LIMITS = {
  /** Maximum AI <-> tools round trips per operation. */
  maxSteps: { ingest: 40, query: 15 },
  /** Total tokens (input + output, all steps) after which the operation is stopped. */
  tokenBudget: { ingest: 500_000, query: 150_000 },
  /** Maximum tokens the AI may generate in one step (one wiki page fits easily). */
  maxOutputTokens: 8_000,
  /** Larger sources are refused for ingestion (about 15k tokens): split them first. */
  sourceChars: 60_000,
  /** Larger pages are refused by write_page: the AI must split them into several pages. */
  pageChars: 20_000,
  /** Previous messages of a conversation sent to the AI with a new question. */
  historyMessages: 20,
};
