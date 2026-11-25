import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { apiErrorMessage } from '../../../core/api-error';
import { LogEntry, LogService } from './log.service';
import { timeAgo } from './time-ago';

@Component({
  selector: 'app-log',
  imports: [DatePipe],
  templateUrl: './log.html',
})
export class Log {
  private readonly logs = inject(LogService);

  protected readonly entries = signal<LogEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly timeAgo = timeAgo;

  constructor() {
    this.load();
  }

  protected load() {
    this.loading.set(true);
    this.error.set(null);
    this.logs.list().subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      },
    });
  }

  /** Page groups to show under an entry, empty ones skipped. */
  protected pageGroups(e: LogEntry) {
    return [
      { label: 'Created', pages: e.pagesCreated, style: 'bg-emerald-50 text-emerald-700' },
      { label: 'Updated', pages: e.pagesUpdated, style: 'bg-amber-50 text-amber-700' },
      { label: 'Read', pages: e.pagesRead, style: 'bg-zinc-100 text-zinc-600' },
    ].filter((g) => g.pages.length > 0);
  }
}
