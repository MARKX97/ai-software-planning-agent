import { Global, Injectable, Module } from '@nestjs/common';
import { prisma } from '@ai-planning/database';

/**
 * Thin injectable wrapper around the Prisma client singleton exported by
 * `@ai-planning/database`. Exposed as `PrismaService` so feature modules
 * inject a Nest provider rather than importing the package directly.
 *
 * @internal
 */
@Injectable()
export class PrismaService {
  /** The underlying Prisma client singleton. */
  readonly client = prisma;
}

/**
 * Global provider of {@link PrismaService}.
 * @internal
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
