import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = {
    ...originalEnv,
    NODE_ENV: 'test',
    CORS_ORIGINS: 'http://localhost:5173',
  };
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_DRESS_ME_MODEL;
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
});

describe('OpenAI Dress Me environment configuration', () => {
  it('allows AI configuration to be omitted so baseline remains available', async () => {
    const { assertRuntimeConfiguration, env } = await import('./env.js');
    expect(env.openAiApiKey).toBeUndefined();
    expect(env.openAiDressMeModel).toBeUndefined();
    expect(() => assertRuntimeConfiguration()).not.toThrow();
  });

  it('requires API key and model together', async () => {
    process.env.OPENAI_API_KEY = 'server-secret';
    const keyOnly = await import('./env.js');
    expect(() => keyOnly.assertRuntimeConfiguration()).toThrow(/must be configured together/i);

    vi.resetModules();
    delete process.env.OPENAI_API_KEY;
    process.env.OPENAI_DRESS_ME_MODEL = 'deployment-model';
    const modelOnly = await import('./env.js');
    expect(() => modelOnly.assertRuntimeConfiguration()).toThrow(/must be configured together/i);
  });

  it('accepts complete server-only AI configuration', async () => {
    process.env.OPENAI_API_KEY = 'server-secret';
    process.env.OPENAI_DRESS_ME_MODEL = 'deployment-model';
    const { assertRuntimeConfiguration, env } = await import('./env.js');
    expect(env.openAiApiKey).toBe('server-secret');
    expect(env.openAiDressMeModel).toBe('deployment-model');
    expect(() => assertRuntimeConfiguration()).not.toThrow();
  });
});
