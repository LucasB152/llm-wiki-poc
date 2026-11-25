import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_URL } from '../../core/api';

export type AiProvider = 'GEMINI' | 'OPENAI' | 'ANTHROPIC' | 'GROQ';

export interface ProviderInfo {
  id: AiProvider;
  name: string;
  vendor: string;
  logo: string;
  placeholder: string;
}

/** Display info of each provider, in display order. */
export const PROVIDERS: ProviderInfo[] = [
  { id: 'GROQ', name: 'Groq', vendor: 'Groq', logo: 'logos/groq.svg', placeholder: 'gsk_...' },
  { id: 'GEMINI', name: 'Gemini', vendor: 'Google', logo: 'logos/gemini.svg', placeholder: 'AIza...' },
  { id: 'ANTHROPIC', name: 'Claude', vendor: 'Anthropic', logo: 'logos/claude.svg', placeholder: 'sk-ant-...' },
  { id: 'OPENAI', name: 'ChatGPT', vendor: 'OpenAI', logo: 'logos/openai.svg', placeholder: 'sk-proj-...' },
];

export interface ModelInfo {
  id: string;
  name: string;
}

/** The backend never sends the plain key back, only a masked one ("sk-a****1234"). */
export interface StoredApiKey {
  provider: AiProvider;
  key: string;
}

@Injectable({ providedIn: 'root' })
export class ApiKeyService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/llm/api-key`;

  list() {
    return this.http.get<StoredApiKey[]>(this.url);
  }

  /** The backend checks the key against the provider before saving it. */
  save(provider: AiProvider, key: string) {
    return this.http.post<StoredApiKey>(this.url, { provider, key });
  }

  /** Models available with the provider's stored key (404 if none is stored). */
  models(provider: AiProvider) {
    return this.http.get<{ models: ModelInfo[] }>(`${API_URL}/llm/models/${provider}`);
  }

  remove(provider: AiProvider) {
    return this.http.delete(`${this.url}/${provider}`);
  }
}
