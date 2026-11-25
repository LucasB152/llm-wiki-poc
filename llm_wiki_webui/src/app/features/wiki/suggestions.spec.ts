import { pageTitle, pickRandom, questionFor } from './suggestions';

describe('wiki suggestions', () => {
  it('uses the first heading as the page title', () => {
    expect(pageTitle('# Optical fiber\n\nText.', 'optical-fiber.md')).toBe('Optical fiber');
  });

  it('falls back to the file name without a heading', () => {
    expect(pageTitle('No heading here', 'tcp-handshake.md')).toBe('tcp handshake');
  });

  it('asks "what is" with a lowercase first letter', () => {
    expect(questionFor('Optical fiber')).toBe('What is optical fiber?');
  });

  it('keeps acronyms as they are', () => {
    expect(questionFor('TCP')).toBe('What is TCP?');
    expect(questionFor('IPv4 addressing')).toBe('What is IPv4 addressing?');
  });

  it('turns a comparison page into a "difference" question', () => {
    expect(questionFor('TCP vs UDP')).toBe('What is the difference between TCP and UDP?');
  });

  it('picks distinct items, at most the requested count', () => {
    const picked = pickRandom(['a', 'b', 'c', 'd'], 3);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
    expect(pickRandom(['a'], 3)).toEqual(['a']);
  });
});
