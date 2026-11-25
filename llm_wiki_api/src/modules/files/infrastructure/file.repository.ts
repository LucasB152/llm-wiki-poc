import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { FileArea } from '../../../generated/prisma/enums';

/** Stores the wiki text files in the database (one row per area + name). */
@Injectable()
export class FileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(area: FileArea): Promise<string[]> {
    const rows = await this.prisma.wikiFile.findMany({
      where: { area },
      select: { name: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => row.name);
  }

  /** Names with their last modification date. */
  listWithDates(area: FileArea) {
    return this.prisma.wikiFile.findMany({
      where: { area },
      select: { name: true, modifiedAt: true },
      orderBy: { name: 'asc' },
    });
  }

  /** Content of the file, or null if it does not exist. */
  async find(area: FileArea, name: string): Promise<string | null> {
    const row = await this.prisma.wikiFile.findUnique({
      where: { area_name: { area, name } },
      select: { content: true },
    });
    return row?.content ?? null;
  }

  /** Creates the file. Returns false if it already exists. */
  async create(
    area: FileArea,
    name: string,
    content: string,
  ): Promise<boolean> {
    try {
      await this.prisma.wikiFile.create({ data: { area, name, content } });
      return true;
    } catch (error) {
      // P2002 = unique constraint (area, name). No `instanceof`: unreliable across realms (e.g. under Jest).
      if ((error as { code?: string } | null)?.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }

  /** Creates the files that do not exist yet, leaves the others untouched. */
  async createMissing(
    files: { area: FileArea; name: string; content: string }[],
  ) {
    await this.prisma.wikiFile.createMany({
      data: files,
      skipDuplicates: true,
    });
  }

  /** Replaces the content of an existing file. Returns false if it does not exist. */
  async update(
    area: FileArea,
    name: string,
    content: string,
  ): Promise<boolean> {
    const { count } = await this.prisma.wikiFile.updateMany({
      where: { area, name },
      data: { content },
    });
    return count > 0;
  }

  /** Returns false if the file did not exist. */
  async delete(area: FileArea, name: string): Promise<boolean> {
    const { count } = await this.prisma.wikiFile.deleteMany({
      where: { area, name },
    });
    return count > 0;
  }
}
