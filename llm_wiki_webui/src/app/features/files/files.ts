import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { apiErrorMessage } from '../../core/api-error';
import { FilesService, IngestResult, SourceStatus } from './files.service';
import { ModelChoice, ModelPicker } from '../llm/model-picker';
import { Log } from './log/log';

type Tab = 'raw' | 'wiki' | 'schema' | 'log';

@Component({
  selector: 'app-files',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  imports: [Log, ModelPicker],
  templateUrl: './files.html',
})
export class Files {
  private readonly api = inject(FilesService);
  private readonly route = inject(ActivatedRoute);

  protected readonly tabs: { id: Tab; label: string }[] = [
    { id: 'raw', label: 'Sources' },
    { id: 'wiki', label: 'Wiki pages' },
    { id: 'schema', label: 'AI instructions' },
    { id: 'log', label: 'Log' },
  ];

  protected readonly tab = signal<Tab>('raw');
  protected readonly files = signal<string[]>([]);
  /** Open file name ('AGENTS.md' on the schema tab, null when nothing is open). */
  protected readonly selected = signal<string | null>(null);
  /** Content as saved on the server. */
  protected readonly content = signal('');
  /** Text being edited; null = read mode. */
  protected readonly draft = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Ingestion status of each source (Sources tab). */
  protected readonly statuses = signal<Record<string, SourceStatus>>({});
  protected readonly statusLabels: Record<SourceStatus, { label: string; dot: string; badge: string }> = {
    not_ingested: { label: 'Not ingested', dot: 'bg-zinc-300', badge: 'bg-zinc-100 text-zinc-600' },
    ingested: { label: 'Ingested', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700' },
    failed: { label: 'Ingestion failed', dot: 'bg-red-500', badge: 'bg-red-50 text-red-700' },
    outdated: { label: 'Edited since ingestion', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700' },
  };
  /** Ingest panel of the open source. */
  protected readonly ingestOpen = signal(false);
  protected readonly ingestWith = signal<ModelChoice | null>(null);
  /**
   * Sources sent for ingestion, in order. The backend runs them one at a time,
   * so the first one is in progress and the others are queued.
   */
  protected readonly ingesting = signal<string[]>([]);
  /** Result of the last successful ingestion of each source. */
  protected readonly results = signal<Record<string, IngestResult>>({});

  constructor() {
    // Links from the chat: /files?page=network-layer.md or /files?source=03-network-layer.md
    const query = this.route.snapshot.queryParamMap;
    const page = query.get('page');
    if (page) this.tab.set('wiki');
    this.loadList();
    const name = page ?? query.get('source');
    if (name) this.open(name);
  }

  protected selectTab(tab: Tab) {
    if (tab === this.tab() || !this.confirmDiscard()) return;
    this.tab.set(tab);
    this.close();
    if (tab === 'schema') {
      this.call(this.api.readSchema(), (f) => this.show(f.name, f.content));
    } else if (tab !== 'log') {
      this.loadList();
    }
  }

  protected open(name: string) {
    if (name === this.selected() || !this.confirmDiscard()) return;
    const area = this.tab() as 'raw' | 'wiki';
    this.call(this.api.read(area, name), (f) => this.show(f.name, f.content));
  }

  protected edit() {
    this.draft.set(this.content());
  }

  protected cancel() {
    if (this.confirmDiscard()) this.draft.set(null);
  }

  protected save() {
    const content = this.draft() ?? '';
    if (this.tab() === 'schema') {
      this.call(this.api.writeSchema(content), (f) => this.show(f.name, f.content));
      return;
    }
    const name = this.selected()!;
    this.call(this.api.updateRaw(name, content), () => {
      this.show(name, content);
      this.loadList(); // an edited source must be ingested again
    });
  }

  /** Label and look of the Ingest button, from the source status. */
  protected ingestAction(status: SourceStatus | undefined) {
    switch (status) {
      case 'failed':
        return { label: 'Retry ingestion', primary: true };
      case 'outdated':
        return { label: 'Re-ingest', primary: true };
      case 'ingested':
        return { label: 'Re-ingest', primary: false };
      default:
        return { label: 'Ingest', primary: true };
    }
  }

  /** 'Ingesting…' for the source in progress, 'Queued' for the others, null if not sent. */
  protected ingestState(name: string) {
    const index = this.ingesting().indexOf(name);
    return index < 0 ? null : index === 0 ? 'Ingesting…' : 'Queued';
  }

  protected ingest() {
    const name = this.selected();
    const choice = this.ingestWith();
    if (!name || !choice || this.ingestState(name)) return;
    if (
      this.statuses()[name] === 'ingested' &&
      !confirm('This source is already ingested and unchanged. Re-ingest it anyway?')
    ) {
      return;
    }
    // Closed right away: the user can open the next source and queue it too.
    this.ingestOpen.set(false);
    this.ingesting.update((names) => [...names, name]);
    this.results.update(({ [name]: _, ...others }) => others);
    this.api.ingest(name, choice.provider, choice.model).subscribe({
      next: (result) => {
        this.ingesting.update((names) => names.filter((n) => n !== name));
        this.results.update((r) => ({ ...r, [name]: result }));
        this.loadList();
      },
      error: (err) => {
        this.ingesting.update((names) => names.filter((n) => n !== name));
        this.loadList(); // the failure is logged: refresh the status
        this.error.set(`${name}: ${apiErrorMessage(err)}`); // after loadList(), which clears the error
      },
    });
  }

  protected remove() {
    const name = this.selected();
    if (!name || !confirm(`Delete "${name}"? This cannot be undone.`)) return;
    this.call(this.api.remove(this.tab() as 'raw' | 'wiki', name), () => {
      this.close();
      this.loadList();
    });
  }

  protected upload(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = ''; // lets the user pick the same file again after an error
    if (!file) return;
    this.call(this.api.uploadRaw(file), () => {
      this.loadList();
      this.open(file.name);
    });
  }

  /**
   * Asks before throwing away unsaved edits.
   * Returns true when it is OK to leave the current file.
   */
  private confirmDiscard(): boolean {
    const draft = this.draft();
    if (draft === null || draft === this.content()) {
      return true;
    }
    return confirm('You have unsaved changes. Discard them?')
  }

  private loadList() {
    const tab = this.tab();
    if (tab === 'schema' || tab === 'log') return;
    if (tab === 'raw') {
      this.call(this.api.sources(), (sources) => {
        this.files.set(sources.map((s) => s.name));
        this.statuses.set(Object.fromEntries(sources.map((s) => [s.name, s.status])));
      });
    } else {
      this.call(this.api.list(tab), (files) => this.files.set(files));
    }
  }

  private show(name: string, content: string) {
    if (name !== this.selected()) this.ingestOpen.set(false);
    this.selected.set(name);
    this.content.set(content);
    this.draft.set(null);
  }

  private close() {
    this.ingestOpen.set(false);
    this.selected.set(null);
    this.content.set('');
    this.draft.set(null);
  }

  /** Shared busy / error handling for every API call. */
  private call<T>(request: Observable<T>, onSuccess: (res: T) => void) {
    this.busy.set(true);
    this.error.set(null);
    request.subscribe({
      next: (res) => {
        this.busy.set(false);
        onSuccess(res);
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      },
    });
  }
}
