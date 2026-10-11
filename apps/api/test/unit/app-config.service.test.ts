import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AppConfigService } from '../../src/config/app-config.service.js';

describe('AppConfigService', () => {
  it('reads a separate Baishan key for each provider', () => {
    const env = process.env;
    process.env = {
      ...env,
      BAISHAN_API_KEY_DEEPSEEK: 'deepseek-key',
      BAISHAN_API_KEY_GLM: 'glm-key',
      BAISHAN_API_KEY_MINIMAX: 'minimax-key',
    };
    try {
      const config = new AppConfigService();
      assert.deepEqual(config.baishanApiKeys, {
        deepseek: 'deepseek-key',
        glm: 'glm-key',
        minimax: 'minimax-key',
      });
    } finally {
      process.env = env;
    }
  });
});
