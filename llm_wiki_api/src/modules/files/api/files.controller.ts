import {
  Body,
  Controller,
  Delete,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from '../application/files.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { UpdateFileDto } from './dto/update-file.dto';
import { WikiArea } from '../domain/files.constants';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // ---- Schema (AGENTS.md) -------------------------------------------------

  @Get('schema')
  readSchema() {
    return this.filesService.readSchema();
  }

  @Put('schema')
  writeSchema(@Body() { content }: UpdateFileDto) {
    return this.filesService.writeSchema(content);
  }

  // ---- raw/: raw sources (the AI never modifies them, the user can) --------

  @Get('raw/:name')
  readRaw(@Param('name') name: string) {
    return this.filesService.findOne(WikiArea.RAW, name);
  }

  /**
   * Adds a source (multipart/form-data).
   * Fields: `file` (the file) and `name` (optional, defaults to the original name).
   */
  @Post('raw/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadRaw(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
    @Body() { name }: UploadFileDto,
  ) {
    return this.filesService.addRaw(name ?? file.originalname, file.buffer);
  }

  /** Edits an existing source (JSON: `{ "content": "..." }`); new sources go through upload. */
  @Put('raw/:name')
  updateRaw(@Param('name') name: string, @Body() { content }: UpdateFileDto) {
    return this.filesService.updateRaw(name, content);
  }

  @Delete('raw/:name')
  removeRaw(@Param('name') name: string) {
    return this.filesService.remove(WikiArea.RAW, name);
  }

  // ---- wiki/: pages maintained by the LLM, read-only through the API -------
  // The AI writes pages with its write_page tool (FilesService.writeWikiPage).

  @Get('wiki')
  listWiki() {
    return this.filesService.findAll(WikiArea.WIKI);
  }

  @Get('wiki/:name')
  readWiki(@Param('name') name: string) {
    return this.filesService.findOne(WikiArea.WIKI, name);
  }
}
