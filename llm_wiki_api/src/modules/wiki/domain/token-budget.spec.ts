import { tokensUsed } from './token-budget';

const step = (totalTokens: number | undefined) => ({ usage: { totalTokens } });

describe('tokensUsed', () => {
  it('is 0 before the first step', () => {
    expect(tokensUsed([])).toBe(0);
  });

  it('adds up the tokens of every step', () => {
    expect(tokensUsed([step(1200), step(3400), step(5000)])).toBe(9600);
  });

  it('counts a step without reported usage as 0', () => {
    expect(tokensUsed([step(1000), step(undefined), step(500)])).toBe(1500);
  });
});
