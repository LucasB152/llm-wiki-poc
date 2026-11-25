import { Module } from '@nestjs/common';
import { FilesService } from './application/files.service';
import { FileRepository } from './infrastructure/file.repository';
import { FilesController } from './api/files.controller';

@Module({
  controllers: [FilesController],
  providers: [FilesService, FileRepository],
  exports: [FilesService],
})
export class FilesModule {}
