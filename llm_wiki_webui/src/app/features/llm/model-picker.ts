import { Component, OnInit, computed, inject, model, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api-error';
import { AiProvider, ApiKeyService, ModelInfo, PROVIDERS, ProviderInfo } from './api-key.service';

export interface ModelChoice {
  provider: AiProvider;
  model: string;
}

/** Provider + model selects, limited to the providers that have a stored API key. */
@Component({
  selector: 'app-model-picker',
  // Custom elements are inline by default: block so the parent's spacing (space-y-*) applies.
  host: { class: 'block' },
  imports: [RouterLink],
  templateUrl: './model-picker.html',
})
export class ModelPicker implements OnInit {
  private readonly apiKeys = inject(ApiKeyService);

  /** Two-way bound: [(selection)]. Null until a model is picked. */
  readonly selection = model<ModelChoice | null>(null);

  protected readonly providers = signal<ProviderInfo[] | null>(null);
  protected readonly provider = signal<AiProvider | null>(null);
  protected readonly currentProvider = computed(() => PROVIDERS.find((p) => p.id === this.provider()));
  protected readonly models = signal<ModelInfo[]>([]);
  protected readonly loadingModels = signal(false);
  protected readonly error = signal<string | null>(null);

  // ngOnInit, not the constructor: the bound `selection` is only set by then.
  ngOnInit() {
    this.apiKeys.list().subscribe({
      next: (keys) => {
        const configured = PROVIDERS.filter((p) => keys.some((k) => k.provider === p.id));
        this.providers.set(configured);
        // Keep the previous choice (e.g. when queuing several ingestions), else auto-pick a lone provider.
        const previous = this.selection()?.provider;
        if (previous && configured.some((p) => p.id === previous)) this.loadModels(previous);
        else if (configured.length === 1) this.chooseProvider(configured[0].id);
        else this.selection.set(null);
      },
      error: (err) => this.error.set(apiErrorMessage(err)),
    });
  }

  protected chooseProvider(provider: AiProvider) {
    this.selection.set(null);
    this.loadModels(provider);
  }

  private loadModels(provider: AiProvider) {
    this.provider.set(provider);
    this.models.set([]);
    this.error.set(null);
    this.loadingModels.set(true);
    this.apiKeys.models(provider).subscribe({
      next: ({ models }) => {
        this.models.set(models);
        this.loadingModels.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.loadingModels.set(false);
      },
    });
  }

  protected chooseModel(id: string) {
    const provider = this.provider();
    this.selection.set(provider && id ? { provider, model: id } : null);
  }
}
