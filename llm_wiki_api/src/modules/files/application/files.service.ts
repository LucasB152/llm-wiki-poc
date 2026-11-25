import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  FILE_NAME_PATTERN,
  INDEX_FILE,
  SCHEMA_FILE,
  WikiArea,
} from '../domain/files.constants';
import { DEFAULT_INDEX, DEFAULT_SCHEMA } from '../domain/wiki-templates';
import { FileRepository } from '../infrastructure/file.repository';

/**
 * Access to the LLM Wiki files, stored in the database:
 *
 *   schema  AGENTS.md (wiki schema)
 *   raw     raw sources (written by the user, never by the AI)
 *   wiki    generated pages (including index.md)
 */
@Injectable()
export class FilesService implements OnModuleInit {
  constructor(private readonly files: FileRepository) {}

  /** Creates the default files if they are missing. */
  async onModuleInit() {
    await this.files.createMissing([
      { area: 'schema', name: SCHEMA_FILE, content: DEFAULT_SCHEMA },
      { area: WikiArea.WIKI, name: INDEX_FILE, content: DEFAULT_INDEX },
    ]);
  }

  /** Lists the file names of an area. */
  findAll(area: WikiArea): Promise<string[]> {
    return this.files.list(area);
  }

  /** Lists the files of an area with their last modification date. */
  findAllWithDates(area: WikiArea) {
    return this.files.listWithDates(area);
  }

  async findOne(area: WikiArea, name: string) {
    this.checkName(name);
    const content = await this.files.find(area, name);
    if (content === null)
      throw new NotFoundException(`File "${name}" not found`);
    return { area, name, content };
  }

  /** Adds a raw source (409 if it already exists: edits go through updateRaw). */
  async addRaw(name: string, data: Buffer) {
    this.checkName(name);
    if (!(await this.files.create(WikiArea.RAW, name, this.decodeText(data)))) {
      throw new ConflictException(`Raw source "${name}" already exists`);
    }
    return { area: WikiArea.RAW, name, size: data.length };
  }

  /** Replaces the content of an existing raw source (404 if it does not exist). */
  async updateRaw(name: string, content: string) {
    this.checkName(name);
    if (!(await this.files.update(WikiArea.RAW, name, content))) {
      throw new NotFoundException(`File "${WikiArea.RAW}/${name}" not found`);
    }
    return { area: WikiArea.RAW, name };
  }

  /** Creates or replaces a wiki page. */
  async writeWikiPage(name: string, content: string) {
    this.checkName(name);
    let created = false;
    if (!(await this.files.update(WikiArea.WIKI, name, content))) {
      created = await this.files.create(WikiArea.WIKI, name, content);
      // Created by a concurrent call in the meantime: overwrite it.
      if (!created) await this.files.update(WikiArea.WIKI, name, content);
    }
    return { area: WikiArea.WIKI, name, created };
  }

  /** Deletes a file from an area (404 if it does not exist). */
  async remove(area: WikiArea, name: string) {
    this.checkName(name);
    if (!(await this.files.delete(area, name))) {
      throw new NotFoundException(`File "${area}/${name}" not found`);
    }
    return { area, name, deleted: true };
  }

  async readSchema() {
    const content = await this.files.find('schema', SCHEMA_FILE);
    return { name: SCHEMA_FILE, content: content ?? DEFAULT_SCHEMA };
  }

  async writeSchema(content: string) {
    if (!(await this.files.update('schema', SCHEMA_FILE, content))) {
      await this.files.create('schema', SCHEMA_FILE, content);
    }
    return { name: SCHEMA_FILE, content };
  }

  /**
   * Uploaded sources are stored as text: rejects anything that is not a
   * UTF-8 text file (PostgreSQL TEXT columns cannot hold binary data).
   */
  private decodeText(data: Buffer): string {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let text: string;
    try {
      text = decoder.decode(data);
    } catch {
      throw new BadRequestException(
        'Only Markdown or text file can be uploaded.',
      );
    }
    if (text.includes('\0')) {
      throw new BadRequestException(
        'Only Markdown or text file can be uploaded.',
      );
    }
    return text;
  }

  /** Same names as before (no "/", no ".."), even though files are no longer on disk. */
  private checkName(name: string) {
    if (!FILE_NAME_PATTERN.test(name)) {
      throw new BadRequestException(`Invalid file name "${name}"`);
    }
  }
}
