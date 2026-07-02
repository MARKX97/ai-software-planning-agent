import { Module, Global } from '@nestjs/common';
import { AppConfigService } from './app-config.service.js';

/**
 * Global config module exposing {@link AppConfigService}.
 *
 * @internal
 */
@Global()
@Module({
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class ConfigModule {}
