import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AppConfigService } from '../../config/app-config.service.js';

export class EmbeddingError extends Error {
  constructor(readonly code: 'EMBEDDING_FAILED' | 'EMBEDDING_DIMENSION_MISMATCH') {
    super(
      code === 'EMBEDDING_FAILED'
        ? 'Embedding service unavailable'
        : 'Embedding dimension mismatch',
    );
  }
}

@Injectable()
export class EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;
  readonly retrievalEnabled: boolean;

  constructor(private readonly config: AppConfigService) {
    this.model = config.embeddingModel;
    this.dimensions = config.embeddingDimensions;
    this.retrievalEnabled = config.ragEnabled;
    if (config.embeddingProvider === 'openai-compatible') this.validateRemoteConfig();
  }

  async embedDocuments(texts: readonly string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const vectors =
      this.config.embeddingProvider === 'mock'
        ? texts.map((text) => mockVector(text, this.dimensions))
        : await this.fetchVectors(texts);
    if (vectors.some((vector) => !validVector(vector, this.dimensions))) {
      throw new EmbeddingError('EMBEDDING_DIMENSION_MISMATCH');
    }
    return vectors;
  }

  private validateRemoteConfig(): void {
    try {
      const url = new URL(this.config.embeddingBaseUrl);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
    } catch {
      throw new Error('EMBEDDING_BASE_URL must be a valid HTTP(S) URL');
    }
    if (!this.config.embeddingApiKey) throw new Error('EMBEDDING_API_KEY is required');
    if (!this.model) throw new Error('EMBEDDING_MODEL is required');
  }

  private async fetchVectors(texts: readonly string[]): Promise<number[][]> {
    let response: Response;
    try {
      response = await fetch(`${this.config.embeddingBaseUrl.replace(/\/$/, '')}/embeddings`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.config.embeddingApiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ model: this.model, input: texts, dimensions: this.dimensions }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new EmbeddingError('EMBEDDING_FAILED');
    }
    if (!response.ok) throw new EmbeddingError('EMBEDDING_FAILED');
    const body: unknown = await response.json().catch(() => null);
    const data = isRecord(body) && Array.isArray(body['data']) ? body['data'] : [];
    const ordered = data
      .filter(isRecord)
      .sort((left, right) => Number(left['index']) - Number(right['index']))
      .map((item) => item['embedding']);
    if (ordered.length !== texts.length || !ordered.every(Array.isArray)) {
      throw new EmbeddingError('EMBEDDING_FAILED');
    }
    return ordered as number[][];
  }
}

function mockVector(text: string, dimensions: number): number[] {
  const digest = createHash('sha256').update(text).digest();
  const vector = Array.from(
    { length: dimensions },
    (_, index) => ((digest[index % digest.length] ?? 0) - 127.5) / 127.5,
  );
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

function validVector(vector: readonly number[], dimensions: number): boolean {
  return vector.length === dimensions && vector.every(Number.isFinite);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
