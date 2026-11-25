import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_URL } from '../../../core/api';

/** One row of GET /wiki/log. */
export interface LogEntry {
  createdAt: string;
  operation: 'ingest' | 'query';
  /** Ingested source name, or the question asked. */
  subject: string;
  pagesCreated: string[];
  pagesUpdated: string[];
  pagesRead: string[];
  status: 'success' | 'failed';
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class LogService {
  private readonly http = inject(HttpClient);

  /** Most recent first. */
  list() {
    return this.http.get<LogEntry[]>(`${API_URL}/wiki/log`);
  }
}
