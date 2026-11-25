import { Module } from '@nestjs/common';
import { WikiService } from './application/wiki.service';
import { WikiController } from './api/wiki.controller';
import { LlmModule } from '../llm';
import { FilesModule } from '../files';
import { LogRepository } from './infrastructure/log.repository';

@Module({
  imports: [LlmModule, FilesModule],
  controllers: [WikiController],
  providers: [WikiService, LogRepository],
})
export class WikiModule {}
