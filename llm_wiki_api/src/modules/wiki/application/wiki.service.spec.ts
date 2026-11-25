import { MockLanguageModelV4 } from 'ai/test';

type LanguageModelV4GenerateResult = Awaited<
  ReturnType<MockLanguageModelV4['doGenerate']>
>;
import { WikiService } from './wiki.service';
import { FilesService, WikiArea } from '../../files';
import { FileRepository } from '../../files/infrastructure/file.repository';
import {
  LogRepository,
  type NewLogEntry,
} from '../infrastructure/log.repository';
import {
  AiProvider,
  ConversationRepository,
  ModelService,
  type NewMessage,
} from '../../llm';

/** In-memory stand-in for the database-backed FileRepository. */
class FakeFileRepository {
  files = new Map<string, string>();
  private key = (area: string, name: string) => `${area}/${name}`;

  list(area: string) {
    const prefix = `${area}/`;
    return Promise.resolve(
      [...this.files.keys()]
        .filter((k) => k.startsWith(prefix))
        .map((k) => k.slice(prefix.length))
        .sort(),
    );
  }
  find(area: string, name: string) {
    return Promise.resolve(this.files.get(this.key(area, name)) ?? null);
  }
  create(area: string, name: string, content: string) {
    if (this.files.has(this.key(area, name))) return Promise.resolve(false);
    this.files.set(this.key(area, name), content);
    return Promise.resolve(true);
  }
  async createMissing(
    files: { area: string; name: string; content: string }[],
  ) {
    for (const f of files) await this.create(f.area, f.name, f.content);
  }
  update(area: string, name: string, content: string) {
    if (!this.files.has(this.key(area, name))) return Promise.resolve(false);
    this.files.set(this.key(area, name), content);
    return Promise.resolve(true);
  }
  delete(area: string, name: string) {
    return Promise.resolve(this.files.delete(this.key(area, name)));
  }
}

/** In-memory stand-in for the database-backed LogRepository. */
class FakeLogRepository {
  entries: NewLogEntry[] = [];
  add(entry: NewLogEntry) {
    this.entries.push(entry);
    return Promise.resolve();
  }
}

/** In-memory stand-in for the database-backed ConversationRepository. */
class FakeConversationRepository {
  conversations = new Map<
    string,
    { id: string; title: string; messages: (NewMessage & { id: string })[] }
  >();
  private nextId = 0;

  createConversation(title: string) {
    const conversation = { id: `conv-${++this.nextId}`, title, messages: [] };
    this.conversations.set(conversation.id, conversation);
    return Promise.resolve(conversation);
  }

  findConversation(id: string) {
    const conversation = this.conversations.get(id);
    if (!conversation) throw new Error(`unknown conversation ${id}`);
    return Promise.resolve(conversation);
  }

  async addMessage(conversationId: string, message: NewMessage) {
    const created = { id: `msg-${++this.nextId}`, ...message };
    (await this.findConversation(conversationId)).messages.push(created);
    return created;
  }
}

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

let callId = 0;
const toolCall = (
  toolName: string,
  input: object,
): LanguageModelV4GenerateResult => ({
  content: [
    {
      type: 'tool-call',
      toolCallId: `call-${++callId}`,
      toolName,
      input: JSON.stringify(input),
    },
  ],
  finishReason: { unified: 'tool-calls', raw: undefined },
  usage,
  warnings: [],
});

const finalText = (text: string): LanguageModelV4GenerateResult => ({
  content: [{ type: 'text', text }],
  finishReason: { unified: 'stop', raw: undefined },
  usage,
  warnings: [],
});

describe('WikiService', () => {
  let filesService: FilesService;
  let logs: FakeLogRepository;
  let conversations: FakeConversationRepository;
  let languageModel: MockLanguageModelV4;

  const serviceWith = (responses: LanguageModelV4GenerateResult[]) => {
    languageModel = new MockLanguageModelV4({ doGenerate: responses });
    const modelService = {
      getModel: () => Promise.resolve(languageModel),
    } as unknown as ModelService;
    return new WikiService(
      filesService,
      modelService,
      conversations as unknown as ConversationRepository,
      logs as unknown as LogRepository,
    );
  };

  beforeEach(async () => {
    conversations = new FakeConversationRepository();
    logs = new FakeLogRepository();
    filesService = new FilesService(
      new FakeFileRepository() as unknown as FileRepository,
    );
    await filesService.onModuleInit();
    await filesService.addRaw(
      'source.md',
      Buffer.from('# Le modèle OSI a 7 couches.'),
    );
  });

  const read = async (area: WikiArea, name: string) =>
    (await filesService.findOne(area, name)).content;

  it('ingest: écrit les pages demandées par l’IA et journalise', async () => {
    const service = serviceWith([
      toolCall('write_page', {
        name: 'modele-osi.md',
        content: '# Modèle OSI',
      }),
      toolCall('write_page', {
        name: 'index.md',
        content: '# Index\n- [OSI](modele-osi.md)',
      }),
      finalText('Page modele-osi créée.'),
    ]);

    const result = await service.ingest('source.md', {
      provider: AiProvider.ANTHROPIC,
      model: 'mock',
    });
    expect(result.pagesCreated).toEqual(['modele-osi.md']);
    expect(result.pagesUpdated).toEqual(['index.md']);
    expect(result.summary).toBe('Page modele-osi créée.');
    expect(await read(WikiArea.WIKI, 'modele-osi.md')).toBe('# Modèle OSI');
    expect(logs.entries).toEqual([
      {
        operation: 'ingest',
        subject: 'source.md',
        pagesCreated: ['modele-osi.md'],
        pagesUpdated: ['index.md'],
        status: 'success',
      },
    ]);
  });

  it('ingest: refuse les noms de page invalides', async () => {
    const service = serviceWith([
      toolCall('write_page', { name: '../raw/source.md', content: 'pirate' }),
      finalText('fini'),
    ]);

    const result = await service.ingest('source.md', {
      provider: AiProvider.ANTHROPIC,
      model: 'mock',
    });

    expect(result.pagesCreated).toEqual([]);
    expect(await read(WikiArea.RAW, 'source.md')).toContain('7 couches');
  });

  it('ingest: journalise l’échec avec les pages déjà écrites', async () => {
    const service = serviceWith([
      toolCall('write_page', { name: 'modele-osi.md', content: '# OSI' }),
    ]);
    // The provider fails on the second round trip, after one page was written.
    const firstCall = languageModel.doGenerate.bind(languageModel);
    let calls = 0;
    languageModel.doGenerate = (options) =>
      ++calls === 1
        ? firstCall(options)
        : Promise.reject(new Error('quota exceeded'));

    await expect(
      service.ingest('source.md', {
        provider: AiProvider.ANTHROPIC,
        model: 'mock',
      }),
    ).rejects.toThrow('quota exceeded');
    expect(logs.entries).toEqual([
      {
        operation: 'ingest',
        subject: 'source.md',
        pagesCreated: ['modele-osi.md'],
        pagesUpdated: [],
        status: 'failed',
        error: 'ANTHROPIC request failed: quota exceeded',
      },
    ]);
  });

  it('ingest: plusieurs sources lancées en même temps passent l’une après l’autre', async () => {
    await filesService.addRaw(
      'source-b.md',
      Buffer.from('# TCP/IP a 4 couches.'),
    );
    const service = serviceWith([]);
    const events: string[] = [];
    languageModel.doGenerate = async (options) => {
      const source = JSON.stringify(options.prompt).includes('source-b.md')
        ? 'B'
        : 'A';
      events.push(`start ${source}`);
      // A is slow: without the queue, B would start before A ends.
      await new Promise((resolve) =>
        setTimeout(resolve, source === 'A' ? 30 : 0),
      );
      events.push(`end ${source}`);
      return finalText(`done ${source}`);
    };

    const opts = { provider: AiProvider.ANTHROPIC, model: 'mock' };
    const [a, b] = await Promise.all([
      service.ingest('source.md', opts),
      service.ingest('source-b.md', opts),
    ]);

    expect(events).toEqual(['start A', 'end A', 'start B', 'end B']);
    expect([a.summary, b.summary]).toEqual(['done A', 'done B']);
    expect(logs.entries.map((e) => [e.subject, e.status])).toEqual([
      ['source.md', 'success'],
      ['source-b.md', 'success'],
    ]);
  });

  it('query: répond et liste les pages consultées', async () => {
    await filesService.writeWikiPage(
      'modele-osi.md',
      '# Modèle OSI\n7 couches.',
    );
    const service = serviceWith([
      toolCall('read_page', { name: 'modele-osi.md' }),
      finalText('Le modèle OSI a 7 couches ([Modèle OSI](modele-osi.md)).'),
    ]);

    const result = await service.query({
      provider: AiProvider.ANTHROPIC,
      model: 'mock',
      question: 'Combien de couches ?',
    });

    expect(result.answer).toContain('7 couches');
    expect(result.sources.pages).toEqual(['modele-osi.md']);
    expect(logs.entries).toEqual([
      {
        operation: 'query',
        subject: 'Combien de couches ?',
        pagesRead: ['modele-osi.md'],
        pagesCreated: [],
        pagesUpdated: [],
        status: 'success',
      },
    ]);

    // A new conversation holds the question and the answer.
    const conversation = conversations.conversations.get(result.conversationId);
    expect(conversation?.title).toBe('Combien de couches ?');
    expect(conversation?.messages.map((m) => [m.role, m.content])).toEqual([
      ['user', 'Combien de couches ?'],
      ['llm', result.answer],
    ]);
    expect(conversation?.messages[1]).toMatchObject({
      providerName: AiProvider.ANTHROPIC,
      model: 'mock',
      source: { pages: ['modele-osi.md'], raw: [] },
    });
  });

  it('query: écrit une page quand le professeur le demande, et le journalise', async () => {
    await filesService.writeWikiPage(
      'modele-osi.md',
      '# Modèle OSI\n7 couches.',
    );
    const service = serviceWith([
      toolCall('read_page', { name: 'modele-osi.md' }),
      toolCall('write_page', {
        name: 'osi-summary.md',
        content: '# OSI summary\n7 layers.',
      }),
      finalText('Created osi-summary.md.'),
    ]);

    const result = await service.query({
      provider: AiProvider.ANTHROPIC,
      model: 'mock',
      question: 'Save your previous answer to the wiki.',
    });

    expect(await read(WikiArea.WIKI, 'osi-summary.md')).toBe(
      '# OSI summary\n7 layers.',
    );
    expect(result.sources).toEqual({
      pages: ['modele-osi.md'],
      raw: [],
      created: ['osi-summary.md'],
      updated: [],
    });
    expect(logs.entries[0]).toMatchObject({
      operation: 'query',
      pagesCreated: ['osi-summary.md'],
      status: 'success',
    });
  });

  it('query: poursuit une conversation en donnant l’historique à l’IA', async () => {
    const { id } = await conversations.createConversation('OSI');
    await conversations.addMessage(id, { role: 'user', content: 'Question 1' });
    await conversations.addMessage(id, { role: 'llm', content: 'Réponse 1' });
    const service = serviceWith([finalText('Réponse 2')]);

    const result = await service.query({
      provider: AiProvider.ANTHROPIC,
      model: 'mock',
      question: 'Question 2',
      conversationId: id,
    });

    expect(result.conversationId).toBe(id);
    const prompt = languageModel.doGenerateCalls[0].prompt;
    expect(prompt.map((m) => m.role)).toEqual([
      'system',
      'user',
      'assistant',
      'user',
    ]);
    expect(JSON.stringify(prompt[2])).toContain('Réponse 1');
    expect(JSON.stringify(prompt[3])).toContain('Question 2');
    expect(conversations.conversations.get(id)?.messages).toHaveLength(4);
  });
});
