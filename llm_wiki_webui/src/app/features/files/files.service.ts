import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_URL } from '../../core/api';

/** raw = sources (written by the user), wiki = pages written by the AI. */
export type WikiArea = 'raw' | 'wiki';

export type SourceStatus = 'not_ingested' | 'ingested' | 'failed' | 'outdated';

/** One row of GET /wiki/sources. */
export interface SourceInfo {
  name: string;
  modifiedAt: string;
  lastIngestedAt: string | null;
  status: SourceStatus;
}

export interface IngestResult {
  summary: string;
  pagesCreated: string[];
  pagesUpdated: string[];
}

export interface FileContent {
  name: string;
  content: string;
}

@Injectable({ providedIn: 'root' })
export class FilesService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/files`;

  list(area: WikiArea) {
    return this.http.get<string[]>(`${this.url}/${area}`);
  }

  read(area: WikiArea, name: string) {
    return this.http.get<FileContent>(`${this.url}/${area}/${encodeURIComponent(name)}`);
  }

  remove(area: WikiArea, name: string) {
    return this.http.delete(`${this.url}/${area}/${encodeURIComponent(name)}`);
  }

  /** Multipart upload; the backend answers 409 if a source with this name exists. */
  uploadRaw(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post(`${this.url}/raw/upload`, form);
  }

  /** Edits an existing source (404 if it does not exist). */
  updateRaw(name: string, content: string) {
    return this.http.put(`${this.url}/raw/${encodeURIComponent(name)}`, { content });
  }

  /** Raw sources with their ingestion status. */
  sources() {
    return this.http.get<SourceInfo[]>(`${API_URL}/wiki/sources`);
  }

  /** Asks the AI to ingest a source: can take a minute or more. */
  ingest(name: string, provider: string, model: string) {
    return this.http.post<IngestResult>(`${API_URL}/wiki/ingest/${encodeURIComponent(name)}`, { provider, model });
  }

  readSchema() {
    return this.http.get<FileContent>(`${this.url}/schema`);
  }

  writeSchema(content: string) {
    return this.http.put<FileContent>(`${this.url}/schema`, { content });
  }
}
