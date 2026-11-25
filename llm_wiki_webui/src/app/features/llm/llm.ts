import { Component, inject, signal } from '@angular/core';
import { apiErrorMessage } from '../../core/api-error';
import { Observable } from 'rxjs';
import { AiProvider, ApiKeyService, PROVIDERS } from './api-key.service';

@Component({
  selector: 'app-llm',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  templateUrl: './llm.html',
})
export class Llm {
  private readonly apiKeys = inject(ApiKeyService);

  protected readonly providers = PROVIDERS;

  /** Masked key per configured provider. */
  protected readonly stored = signal<Partial<Record<AiProvider, string>>>({});
  protected readonly drafts = signal<Partial<Record<AiProvider, string>>>({});
  protected readonly busy = signal<Partial<Record<AiProvider, boolean>>>({});
  protected readonly errors = signal<Partial<Record<AiProvider, string>>>({});
  protected readonly loadError = signal<string | null>(null);
  protected readonly loading = signal(true);

  constructor() {
    this.load();
  }

  protected load() {
    this.loading.set(true);
    this.loadError.set(null);
    this.apiKeys.list().subscribe({
      next: (keys) => {
        this.stored.set(Object.fromEntries(keys.map((k) => [k.provider, k.key])));
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(apiErrorMessage(err));
        this.loading.set(false);
      },
    });
  }

  protected setDraft(provider: AiProvider, value: string) {
    this.drafts.update((d) => ({ ...d, [provider]: value }));
    this.errors.update((e) => ({ ...e, [provider]: undefined }));
  }

  protected save(provider: AiProvider) {
    const key = this.drafts()[provider]?.trim();
    if (!key) return;
    this.run(provider, this.apiKeys.save(provider, key), (res) => {
      this.stored.update((s) => ({ ...s, [provider]: res.key }));
      this.drafts.update((d) => ({ ...d, [provider]: '' }));
    });
  }

  protected remove(provider: AiProvider) {
    this.run(provider, this.apiKeys.remove(provider), () =>
      this.stored.update((s) => ({ ...s, [provider]: undefined })),
    );
  }

  /** Shared busy / error handling for the save and delete calls. */
  private run<T>(provider: AiProvider, call: Observable<T>, onSuccess: (res: T) => void) {
    this.busy.update((b) => ({ ...b, [provider]: true }));
    this.errors.update((e) => ({ ...e, [provider]: undefined }));
    call.subscribe({
      next: (res) => {
        onSuccess(res);
        this.busy.update((b) => ({ ...b, [provider]: false }));
      },
      error: (err) => {
        this.errors.update((e) => ({ ...e, [provider]: apiErrorMessage(err) }));
        this.busy.update((b) => ({ ...b, [provider]: false }));
      },
    });
  }
}
