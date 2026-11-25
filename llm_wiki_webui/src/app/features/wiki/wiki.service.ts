import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_URL } from '../../core/api';
import { AiProvider } from '../llm/api-key.service';

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  modifiedAt: string;
}

/** Wiki pages and raw sources the AI read to answer. */
export interface AnswerSources {
  pages: string[];
  raw: string[];
  /** Pages the AI created / changed because the teacher asked for it in the chat. */
  created?: string[];
  updated?: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'llm';
  content: string;
  /** AI messages only. */
  model?: string | null;
  source?: AnswerSources | null;
  createdAt: string;
}

export interface QueryResult {
  conversationId: string;
  messageId: string;
  answer: string;
  model: string;
  sources: AnswerSources;
}

@Injectable({ providedIn: 'root' })
export class WikiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/wiki`;

  /** Most recently active first. */
  conversations() {
    return this.http.get<Conversation[]>(`${this.url}/conversations`);
  }

  messages(conversationId: string) {
    return this.http.get<ChatMessage[]>(`${this.url}/conversations/${conversationId}/messages`);
  }

  /** Without conversationId, the backend creates a new conversation. Can take a while. */
  ask(question: string, provider: AiProvider, model: string, conversationId: string | null) {
    return this.http.post<QueryResult>(`${this.url}/query`, {
      question,
      provider,
      model,
      ...(conversationId ? { conversationId } : {}),
    });
  }

  rename(conversationId: string, title: string) {
    return this.http.patch<Conversation>(`${this.url}/conversations/${conversationId}`, { title });
  }

  remove(conversationId: string) {
    return this.http.delete(`${this.url}/conversations/${conversationId}`);
  }
}
