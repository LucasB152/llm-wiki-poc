import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { LogOperation, LogStatus } from '../../../generated/prisma/enums';

export interface NewLogEntry {
  operation: LogOperation;
  /** Ingested source name, or the question asked. */
  subject: string;
  pagesCreated?: string[];
  pagesUpdated?: string[];
  pagesRead?: string[];
  status: LogStatus;
  error?: string;
}

/** Wiki journal: one row per operation, append-only (no update, no delete). */
@Injectable()
export class LogRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** A single INSERT: no lock needed, concurrent operations cannot overwrite each other. */
  async add(entry: NewLogEntry): Promise<void> {
    await this.prisma.logEntry.create({ data: entry });
  }

  /** Latest ingestion attempt of each source, keyed by source name. */
  async lastIngestions() {
    const rows = await this.prisma.logEntry.findMany({
      where: { operation: 'ingest' },
      select: { subject: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const latest = new Map<string, { status: LogStatus; createdAt: Date }>();
    for (const { subject, ...attempt } of rows) {
      if (!latest.has(subject)) latest.set(subject, attempt);
    }
    return latest;
  }

  /** Every entry, most recent first. */
  findAll() {
    return this.prisma.logEntry.findMany({
      select: {
        createdAt: true,
        operation: true,
        subject: true,
        pagesCreated: true,
        pagesUpdated: true,
        pagesRead: true,
        status: true,
        error: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
