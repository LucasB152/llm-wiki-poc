import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  generateText,
  isStepCount,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
} from 'ai';
import { IngestSourceDto } from '../api/dto/ingest-source.dto';
import { QueryWikiDto } from '../api/dto/query-wiki.dto';
import { createIngestTools, createQueryTools, newActivity } from './wiki-tools';
import { ingestInstructions, queryInstructions } from '../domain/wiki.prompts';
import { FilesService, INDEX_FILE, WikiArea } from '../../files';
import {
  AiProvider,
  ConversationRepository,
  MessageRole,
  ModelService,
} from '../../llm';
import {
  LogRepository,
  type NewLogEntry,
} from '../infrastructure/log.repository';
import { sourceStatus } from '../domain/source-status';
import { LIMITS } from '../domain/limits';
import { tokensUsed } from '../domain/token-budget';

/** Maximum length of a conversation title derived from its first question. */
const TITLE_MAX_LENGTH = 100;

@Injectable()
export class WikiService {
  private readonly logger = new Logger(WikiService.name);

  /**
   * Queue of operations that write to the wiki: two concurrent ingestions
   * would each overwrite index.md on their own.
   */
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly filesService: FilesService,
    private readonly modelService: ModelService,
    private readonly conversations: ConversationRepository,
    private readonly logs: LogRepository,
  ) {}

  /** Wiki journal (ingestions and questions), most recent first. */
  log() {
    return this.logs.findAll();
  }

  /** Raw sources with their ingestion status. */
  async sources() {
    const [files, lastIngestions] = await Promise.all([
      this.filesService.findAllWithDates(WikiArea.RAW),
      this.logs.lastIngestions(),
    ]);
    return files.map(({ name, modifiedAt }) => {
      const lastIngest = lastIngestions.get(name);
      return {
        name,
        modifiedAt,
        lastIngestedAt: lastIngest?.createdAt ?? null,
        status: sourceStatus(modifiedAt, lastIngest),
      };
    });
  }

  /** Ingests a source from raw/: the AI creates/updates the wiki pages. */
  async ingest(sourceName: string, { provider, model }: IngestSourceDto) {
    // Checked before queuing and before logging: immediate 404 if the source
    // or the API key is missing (no operation took place, nothing to log).
    const source = await this.filesService.findOne(WikiArea.RAW, sourceName);
    if (source.content.length > LIMITS.sourceChars) {
      throw new BadRequestException(
        `Source too large to ingest (${source.content.length} characters, max ${LIMITS.sourceChars}): split it into smaller files.`,
      );
    }
    const languageModel = await this.modelService.getModel(provider, model);

    this.logger.log(`ingest ${sourceName}: queued`);
    return this.exclusive(async () => {
      const activity = newActivity();
      activity.sourcesRead.add(sourceName);
      const logEntry = () => ({
        operation: 'ingest' as const,
        subject: sourceName,
        pagesCreated: [...activity.pagesCreated],
        pagesUpdated: [...activity.pagesUpdated],
      });

      const result = await this.logged(logEntry, async () =>
        this.run(provider, languageModel, {
          label: `ingest ${sourceName}`,
          instructions: ingestInstructions(await this.schema()),
          prompt:
            `Source to ingest: raw/${sourceName}\n\n` +
            `<source name="${sourceName}">\n${source.content}\n</source>\n\n` +
            `Current index (wiki/${INDEX_FILE}):\n\n${await this.index()}`,
          tools: createIngestTools(this.filesService, activity),
          maxSteps: LIMITS.maxSteps.ingest,
          tokenBudget: LIMITS.tokenBudget.ingest,
        }),
      );
      const { pagesCreated, pagesUpdated } = logEntry();

      return {
        source: sourceName,
        provider,
        model,
        summary: result.text,
        pagesCreated,
        pagesUpdated,
        steps: result.steps.length,
        usage: result.totalUsage,
      };
    });
  }

  /**
   * Answers a question using only the wiki content. The question and the
   * answer are saved in a conversation (created if `conversationId` is
   * omitted), whose previous messages are given to the AI as context.
   */
  async query({ provider, model, question, conversationId }: QueryWikiDto) {
    // Checked before logging: immediate 404 if the conversation or the API
    // key is missing (no operation took place, nothing to log).
    const history = conversationId
      ? (await this.conversations.findConversation(conversationId)).messages
      : [];
    const languageModel = await this.modelService.getModel(provider, model);
    const activity = newActivity();
    const logEntry = () => ({
      operation: 'query' as const,
      subject: question,
      pagesRead: [...activity.pagesRead],
      pagesCreated: [...activity.pagesCreated],
      pagesUpdated: [...activity.pagesUpdated],
    });

    return this.logged(logEntry, async () => {
      const result = await this.run(provider, languageModel, {
        label: 'query',
        instructions: queryInstructions(await this.schema()),
        prompt: [
          // Only the latest messages: a long conversation would be resent at every step.
          ...history
            .slice(-LIMITS.historyMessages)
            .map((message): ModelMessage =>
              message.role === MessageRole.user
                ? { role: 'user', content: message.content }
                : { role: 'assistant', content: message.content },
            ),
          {
            role: 'user',
            content: `Wiki index (wiki/${INDEX_FILE}):\n\n${await this.index()}\n\nQuestion: ${question}`,
          },
        ],
        tools: createQueryTools(this.filesService, activity),
        maxSteps: LIMITS.maxSteps.query,
        tokenBudget: LIMITS.tokenBudget.query,
      });

      // created / updated: pages the teacher asked the AI to write from the chat.
      const sources = {
        pages: [...activity.pagesRead],
        raw: [...activity.sourcesRead],
        created: [...activity.pagesCreated],
        updated: [...activity.pagesUpdated],
      };

      // Saved only once the AI has answered: a failed call leaves no trace.
      const id =
        conversationId ??
        (await this.conversations.createConversation(this.title(question))).id;
      await this.conversations.addMessage(id, {
        role: MessageRole.user,
        content: question,
      });
      const answer = await this.conversations.addMessage(id, {
        role: MessageRole.llm,
        content: result.text,
        providerName: provider,
        model,
        usage: result.totalUsage,
        source: sources,
      });

      return {
        conversationId: id,
        messageId: answer.id,
        question,
        provider,
        model,
        answer: result.text,
        sources,
        steps: result.steps.length,
        usage: result.totalUsage,
      };
    });
  }

  /** Lists the conversations, most recently active first. */
  findConversations() {
    return this.conversations.findConversations();
  }

  /** Messages of a conversation, oldest first. */
  findMessages(id: string) {
    return this.conversations.findMessages(id);
  }

  /** Changes the title of a conversation. */
  renameConversation(id: string, title: string) {
    return this.conversations.renameConversation(id, title.trim());
  }

  /** Deletes a conversation and its messages. */
  deleteConversation(id: string) {
    return this.conversations.deleteConversation(id);
  }

  /** Runs the tool-calling loop and maps provider errors to 502. */
  private async run(
    provider: AiProvider,
    languageModel: LanguageModel,
    opts: {
      /** For the server logs, e.g. "ingest 01-physical-layer.md". */
      label: string;
      instructions: string;
      prompt: string | ModelMessage[];
      tools: ToolSet;
      maxSteps: number;
      /** Total tokens after which the loop is stopped (see LIMITS). */
      tokenBudget: number;
    },
  ) {
    const started = Date.now();
    let step = 0;
    this.logger.log(`${opts.label}: started (${provider})`);
    try {
      const result = await generateText({
        model: languageModel,
        instructions: opts.instructions,
        prompt: opts.prompt,
        tools: opts.tools,
        stopWhen: [
          isStepCount(opts.maxSteps),
          ({ steps }) => tokensUsed(steps) >= opts.tokenBudget,
        ],
        maxOutputTokens: LIMITS.maxOutputTokens,
        // Default is 2: too few for provider overloads (503 "high demand"), frequent on
        // lite models. Exponential backoff (2s, 4s, 8s...): about one minute in total.
        maxRetries: 5,
        // One line per AI round trip: shows progress on long ingestions.
        onStepEnd: ({ toolCalls }) => {
          const calls = toolCalls.map((c) => {
            const name = (c.input as { name?: unknown } | undefined)?.name;
            return typeof name === 'string'
              ? `${c.toolName}(${name})`
              : c.toolName;
          });
          this.logger.log(
            `${opts.label}: step ${++step} ${calls.join(', ') || 'final answer'}`,
          );
        },
      });
      const used = tokensUsed(result.steps);
      this.logger.log(
        `${opts.label}: done in ${step} steps, ${used} tokens, ${Math.round((Date.now() - started) / 1000)}s`,
      );
      if (used >= opts.tokenBudget) {
        // Stopped by the budget, not finished: reported as a failure (and logged as such).
        throw new HttpException(
          `${opts.label} stopped after ${used} tokens: the budget is ${opts.tokenBudget} tokens per operation.`,
          422,
        );
      }
      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`${provider} wiki request failed: ${message}`);
      throw new BadGatewayException(`${provider} request failed: ${message}`);
    }
  }

  /**
   * Runs an AI operation and always logs it, success or failure. `entry` is
   * read at the end, so pages written before a crash are in the log.
   */
  private async logged<T>(
    entry: () => Omit<NewLogEntry, 'status' | 'error'>,
    task: () => Promise<T>,
  ): Promise<T> {
    let result: T;
    try {
      result = await task();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // A logging failure must not hide the original error.
      await this.logs
        .add({ ...entry(), status: 'failed', error: message })
        .catch((e) => this.logger.error(`Could not log the failure: ${e}`));
      throw error;
    }
    await this.logs.add({ ...entry(), status: 'success' });
    return result;
  }

  /** Runs `task` after the write operations already in progress. */
  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const next = this.writeQueue.then(task, task);
    this.writeQueue = next.catch(() => undefined);
    return next;
  }

  private async schema() {
    return (await this.filesService.readSchema()).content;
  }

  private async index() {
    return (await this.filesService.findOne(WikiArea.WIKI, INDEX_FILE)).content;
  }

  /** Conversation title: the first question on a single line, truncated. */
  private title(question: string) {
    const line = question.replace(/\s+/g, ' ').trim();
    return line.length > TITLE_MAX_LENGTH
      ? `${line.slice(0, TITLE_MAX_LENGTH - 1)}…`
      : line;
  }
}
