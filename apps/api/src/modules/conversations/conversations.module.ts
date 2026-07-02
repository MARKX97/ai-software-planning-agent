import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module.js';
import { ConversationsController } from './conversations.controller.js';
import { ConversationsService } from './conversations.service.js';

/** @internal */
@Module({
  imports: [ProjectsModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
