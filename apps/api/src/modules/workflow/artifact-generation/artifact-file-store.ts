import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { Artifact, ArtifactType } from '@ai-planning/database';
import { WorkflowStage } from '@ai-planning/shared';
import type { PrismaService } from '../../../database/database.module.js';
import { ARTIFACT_DISPLAY_NAME } from '../stages/model-routing.js';

export interface StoreArtifactInput {
  readonly projectId: string;
  readonly type: ArtifactType;
  readonly content: string;
}

/** Persists generated Markdown in both the artifact table and DATA_DIR. */
export class ArtifactFileStore {
  constructor(
    private readonly db: PrismaService,
    private readonly dataDir: string,
  ) {}

  async save(input: StoreArtifactInput): Promise<Artifact> {
    const id = randomUUID();
    const relativePath = join('artifacts', input.projectId, `${input.type}-${id}.md`);
    const fullPath = resolve(this.dataDir, relativePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, input.content);
    try {
      return await this.replaceActiveArtifact(input, id, relativePath);
    } catch (error) {
      await rm(fullPath, { force: true });
      throw error;
    }
  }

  async read(projectId: string, type: ArtifactType): Promise<Artifact | null> {
    return this.db.client.artifact.findFirst({
      where: { project_id: projectId, type, deleted_at: null },
      orderBy: { created_at: 'desc' },
    });
  }

  async readContent(artifact: Artifact): Promise<string> {
    if (!artifact.file_path) return artifact.content;
    try {
      return await readFile(resolve(this.dataDir, artifact.file_path), 'utf8');
    } catch {
      return artifact.content;
    }
  }

  private async replaceActiveArtifact(
    input: StoreArtifactInput,
    id: string,
    filePath: string,
  ): Promise<Artifact> {
    const now = new Date();
    await this.db.client.artifact.updateMany({
      where: { project_id: input.projectId, type: input.type, deleted_at: null },
      data: { deleted_at: now, updated_at: now },
    });
    return this.db.client.artifact.create({
      data: {
        id,
        project_id: input.projectId,
        type: input.type,
        type_display_name: ARTIFACT_DISPLAY_NAME[input.type],
        title: ARTIFACT_DISPLAY_NAME[input.type],
        stage: WorkflowStage.PLANNING_GENERATION,
        content: input.content,
        file_path: filePath,
        size_bytes: Buffer.byteLength(input.content, 'utf8'),
        updated_at: now,
      },
    });
  }
}
