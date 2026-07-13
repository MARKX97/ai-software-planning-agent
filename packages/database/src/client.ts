import { PrismaClient } from './generated/prisma/client.js';

/**
 * PrismaClient singleton for the database package.
 *
 * Reuses the global instance in dev to avoid exhausting connections during
 * HMR / repeated script invocations. Outside dev a single module-level
 * client is sufficient.
 *
 * @internal
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/** Shared PrismaClient instance. */
export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}
