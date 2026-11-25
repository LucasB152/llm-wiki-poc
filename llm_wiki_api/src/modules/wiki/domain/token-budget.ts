/** What the AI SDK reports for each step of a tool-calling loop. */
export interface StepUsage {
  usage: { totalTokens: number | undefined };
}

/**
 * Total tokens (input + output) consumed by the steps run so far.
 * Some providers do not report usage for every step: count those as 0.
 */
export function tokensUsed(steps: StepUsage[]): number {
  return steps.reduce(
    (total, step) => total + (step.usage.totalTokens ?? 0),
    0,
  );
}
