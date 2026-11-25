import { Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api-error';
import { renderMarkdown } from '../../core/markdown';
import { timeAgo } from '../files/log/time-ago';
import { ModelChoice, ModelPicker } from '../llm/model-picker';
import { ChatMessage, Conversation, WikiService } from './wiki.service';
import { FilesService } from '../files/files.service';
import { pageTitle, pickRandom, questionFor } from './suggestions';
import { forkJoin, of, switchMap } from 'rxjs';

@Component({
  selector: 'app-wiki',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  imports: [ModelPicker, RouterLink],
  templateUrl: './wiki.html',
})
export class Wiki {
  private readonly api = inject(WikiService);
  private readonly files = inject(FilesService);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  protected readonly renderMarkdown = renderMarkdown;
  protected readonly timeAgo = timeAgo;
  /** Questions built from random wiki pages; null while loading, [] if the wiki is empty. */
  protected readonly suggestions = signal<string[] | null>(null);

  protected readonly conversations = signal<Conversation[]>([]);
  /** Open conversation; null = a new one, created by the backend on the first question. */
  protected readonly currentId = signal<string | null>(null);
  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly draft = signal('');
  protected readonly model = signal<ModelChoice | null>(null);
  /** The AI is answering. */
  protected readonly thinking = signal(false);
  protected readonly loadingMessages = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Conversation whose title is being edited. */
  protected readonly renaming = signal<string | null>(null);

  constructor() {
    this.loadConversations();
    this.loadSuggestions();
    // Keep the latest message in view.
    effect(() => {
      this.messages();
      this.thinking();
      const el = this.scroller()?.nativeElement;
      if (el) queueMicrotask(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }));
    });
  }

  protected newChat() {
    this.currentId.set(null);
    this.messages.set([]);
    this.error.set(null);
  }

  protected open(id: string) {
    if (id === this.currentId() || this.thinking()) return;
    this.currentId.set(id);
    this.messages.set([]);
    this.error.set(null);
    this.loadingMessages.set(true);
    this.api.messages(id).subscribe({
      next: (messages) => {
        this.messages.set(messages);
        this.loadingMessages.set(false);
      },
      error: (err) => {
        this.loadingMessages.set(false);
        this.error.set(apiErrorMessage(err));
      },
    });
  }

  /** Asks the AI to turn its previous answer into a wiki page. */
  protected saveToWiki() {
    this.send(
      'Save your previous answer to the wiki: create a page for it following the wiki conventions ' +
        '(or enrich the most relevant existing page), then update index.md.',
    );
  }

  /** Sends the typed question, or `text` when given (the input is then left untouched). */
  protected send(text?: string) {
    const question = (text ?? this.draft()).trim();
    const choice = this.model();
    if (!question || !choice || this.thinking()) return;

    // Shown right away; removed again if the request fails (the question goes back to the input).
    const pending: ChatMessage = {
      id: `pending-${Date.now()}`,
      role: 'user',
      content: question,
      createdAt: new Date().toISOString(),
    };
    this.messages.update((m) => [...m, pending]);
    if (text === undefined) this.draft.set('');
    this.error.set(null);
    this.thinking.set(true);

    this.api.ask(question, choice.provider, choice.model, this.currentId()).subscribe({
      next: (res) => {
        this.thinking.set(false);
        this.messages.update((m) => [
          ...m,
          {
            id: res.messageId,
            role: 'llm',
            content: res.answer,
            model: res.model,
            source: res.sources,
            createdAt: new Date().toISOString(),
          },
        ]);
        this.currentId.set(res.conversationId);
        this.loadConversations(); // new conversation, or a new modifiedAt
      },
      error: (err) => {
        this.thinking.set(false);
        this.messages.update((m) => m.filter((x) => x !== pending));
        if (text === undefined) this.draft.set(question);
        this.error.set(apiErrorMessage(err));
      },
    });
  }

  /** Enter sends the question, Shift+Enter adds a new line. */
  protected onComposerKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter'){
      return;
    }
    else if (event.shiftKey){
      return;
    }
    // Enter is confirming an accented / IME character, not sending.
    else if (event.isComposing){
      return;
    }
    event.preventDefault(); // no line break in the textarea
    this.send();
  }

  protected rename(conversation: Conversation, title: string) {
    this.renaming.set(null);
    const trimmed = title.trim();
    if (!trimmed || trimmed === conversation.title) return;
    this.api.rename(conversation.id, trimmed).subscribe({
      next: () => this.loadConversations(),
      error: (err) => this.error.set(apiErrorMessage(err)),
    });
  }

  protected remove(conversation: Conversation) {
    if (!confirm(`Delete "${conversation.title}" and all its messages?`)) return;
    this.api.remove(conversation.id).subscribe({
      next: () => {
        if (this.currentId() === conversation.id) this.newChat();
        this.loadConversations();
      },
      error: (err) => this.error.set(apiErrorMessage(err)),
    });
  }

  /** Every suggestion matches an existing page, so the wiki can always answer it. */
  private loadSuggestions() {
    this.files
      .list('wiki')
      .pipe(
        switchMap((names) => {
          const pages = pickRandom(names.filter((n) => n !== 'index.md'), 3);
          return pages.length ? forkJoin(pages.map((n) => this.files.read('wiki', n))) : of([]);
        }),
      )
      .subscribe({
        next: (pages) => this.suggestions.set(pages.map((p) => questionFor(pageTitle(p.content, p.name)))),
        error: () => this.suggestions.set([]), // suggestions are optional: no error banner
      });
  }

  private loadConversations() {
    this.api.conversations().subscribe({
      next: (list) => this.conversations.set(list),
      error: (err) => this.error.set(apiErrorMessage(err)),
    });
  }
}
