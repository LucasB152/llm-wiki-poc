import { sourceStatus } from './source-status';

const edited = new Date('2026-11-25T10:00:00Z');
const before = new Date('2026-11-25T09:00:00Z');
const after = new Date('2026-11-25T11:00:00Z');

describe('sourceStatus', () => {
  it('is not_ingested when the source was never ingested', () => {
    expect(sourceStatus(edited, undefined)).toBe('not_ingested');
  });

  it('is ingested when the last ingestion succeeded after the last edit', () => {
    expect(sourceStatus(edited, { status: 'success', createdAt: after })).toBe(
      'ingested',
    );
  });

  it('is outdated when the source was edited after the last successful ingestion', () => {
    expect(sourceStatus(edited, { status: 'success', createdAt: before })).toBe(
      'outdated',
    );
  });

  it('is failed when the last attempt failed, whatever the dates', () => {
    expect(sourceStatus(edited, { status: 'failed', createdAt: after })).toBe(
      'failed',
    );
    expect(sourceStatus(edited, { status: 'failed', createdAt: before })).toBe(
      'failed',
    );
  });
});
