import type { Artifact, ArtifactType } from '@ai-planning/database';
import { WorkflowStage } from '@ai-planning/shared';
import type { PrismaService } from '../../../database/database.module.js';
import { ARTIFACT_DISPLAY_NAME } from '../stages/model-routing.js';

export interface StoreArtifactInput {
  readonly projectId: string;
  readonly type: ArtifactType;
  readonly content: string;
}

/** Stores generated Markdown artifacts in the existing artifacts table. */
export class ArtifactFileStore {
  constructor(private readonly db: PrismaService) {}

  async save(input: StoreArtifactInput): Promise<Artifact> {
    const now = new Date();
    await this.db.client.artifact.updateMany({
      where: { project_id: input.projectId, type: input.type, deleted_at: null },
      data: { deleted_at: now, updated_at: now },
    });
    return this.db.client.artifact.create({
      data: {
        project_id: input.projectId,
        type: input.type,
        type_display_name: ARTIFACT_DISPLAY_NAME[input.type],
        title: ARTIFACT_DISPLAY_NAME[input.type],
        stage: WorkflowStage.PLANNING_GENERATION,
        content: input.content,
        size_bytes: Buffer.byteLength(input.content, 'utf8'),
        updated_at: now,
      },
    });
  }

  async read(projectId: string, type: ArtifactType): Promise<Artifact | null> {
    return this.db.client.artifact.findFirst({
      where: { project_id: projectId, type, deleted_at: null },
      orderBy: { created_at: 'desc' },
    });
  }
}
