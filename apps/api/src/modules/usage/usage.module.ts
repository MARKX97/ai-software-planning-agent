import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module.js';
import { UsageController } from './usage.controller.js';
import { UsageService } from './usage.service.js';

/** @internal */
@Module({
  imports: [ProjectsModule],
  controllers: [UsageController],
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}
