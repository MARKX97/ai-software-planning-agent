// ============================================================
// Seed — populates reference data (prompt versions) for local dev.
// Run via: pnpm db:seed  (root) -> dotenv + tsx src/seed/index.ts
// ============================================================
import { promptVersionSeed } from './data/prompt-versions.seed.js';
import { prisma } from '../client.js';

async function main(): Promise<void> {
  for (const item of promptVersionSeed) {
    await prisma.promptVersion.upsert({
      where: {
        prompt_name_version: {
          prompt_name: item.prompt_name,
          version: item.version,
        },
      },
      update: { description: item.description },
      create: { ...item },
    });
  }
  console.info(`Seeded ${promptVersionSeed.length} prompt version(s).`);
}

main()
  .catch((err: unknown) => {
    console.error('Seed failed:', err);
    throw err;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });