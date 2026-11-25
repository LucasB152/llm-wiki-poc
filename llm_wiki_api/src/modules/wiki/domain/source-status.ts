import { LogStatus } from '../../../generated/prisma/enums';

/**
 * not_ingested: never ingested · ingested: up to date · failed: the last attempt failed
 * outdated: the source was edited after its last successful ingestion
 */
export type SourceStatus = 'not_ingested' | 'ingested' | 'failed' | 'outdated';

/**
 * Status of a raw source, from its last modification date and its latest
 * ingestion attempt (undefined if it was never ingested).
 */
export function sourceStatus(
  modifiedAt: Date,
  lastIngest: { status: LogStatus; createdAt: Date } | undefined,
): SourceStatus {
  if (lastIngest === undefined) {
    return 'not_ingested';
  } else if (lastIngest.status === 'failed') {
    return 'failed';
  } else if (modifiedAt > lastIngest.createdAt) {
    return 'outdated';
  }
  return 'ingested';
}
