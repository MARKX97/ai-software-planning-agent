import type { ILLMProvider } from '@ai-planning/llm-core';

/**
 * Registry of available providers. The orchestrator calls into this to look
 * up providers by logical name.
 *
 * @internal
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, ILLMProvider>();

  /** Register a provider under its logical name. */
  register(provider: ILLMProvider): void {
    this.providers.set(provider.name, provider);
  }

  /** Get a provider by logical name; throws if unknown. */
  get(name: string): ILLMProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider '${name}' is not registered`);
    }
    return provider;
  }

  /** True when a provider with the given name is registered. */
  has(name: string): boolean {
    return this.providers.has(name);
  }

  /** All registered providers. */
  getAll(): ILLMProvider[] {
    return [...this.providers.values()];
  }

  /** Registered provider names. */
  list(): string[] {
    return [...this.providers.keys()];
  }

  /**
   * Current configured-provider snapshot.
   *
   * This intentionally avoids issuing completions. Public API endpoints such as
   * `/health` and `/models` must not create billable provider traffic.
   */
  async healthCheckAll(): Promise<Record<string, boolean>> {
    const entries = this.getAll().map((p) => [p.name, true] as const);
    return Object.fromEntries(entries);
  }
}
