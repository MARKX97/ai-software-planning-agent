import { Controller, Get } from '@nestjs/common';
import { AppConfigService } from './config/app-config.service.js';

/**
 * Root controller exposing the API root.
 * Kept thin: real endpoints live under feature modules.
 *
 * @internal
 */
@Controller()
export class AppController {
  constructor(private readonly config: AppConfigService) {}

  /**
   * API root metadata endpoint.
   * Returns basic info about the running service.
   */
  @Get()
  getRoot(): { name: string; version: string } {
    return {
      name: 'ai-software-planning-agent-api',
      version: '0.1.0',
    };
  }
}
