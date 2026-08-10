import 'dotenv/config';
import { z } from 'zod';

const optionalSecretSchema = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(1).optional(),
);

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  MONGODB_URI: z.string().min(1).optional(),
  MONGODB_DB_NAME: z.string().min(1).default('wardrope'),
  AUTH_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  WEATHER_API_KEY: z.string().trim().min(1).optional(),
  PRODUCT_SOURCE_BROWSER_PROXY_URL: optionalSecretSchema,
  OPENAI_API_KEY: optionalSecretSchema,
  OPENAI_DRESS_ME_MODEL: optionalSecretSchema,
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map(
      (issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`,
    )
    .join('; ');
  throw new Error(`Invalid Wardrope server configuration: ${details}`);
}

const corsOrigins = parsed.data.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const env = Object.freeze({
  nodeEnv: parsed.data.NODE_ENV,
  port: parsed.data.PORT,
  corsOrigins,
  trustProxyHops: parsed.data.TRUST_PROXY_HOPS,
  mongoUri: parsed.data.MONGODB_URI,
  mongoDbName: parsed.data.MONGODB_DB_NAME,
  authSessionTtlMs: parsed.data.AUTH_SESSION_TTL_HOURS * 60 * 60 * 1_000,
  weatherApiKey: parsed.data.WEATHER_API_KEY,
  productSourceBrowserProxyUrl: parsed.data.PRODUCT_SOURCE_BROWSER_PROXY_URL,
  openAiApiKey: parsed.data.OPENAI_API_KEY,
  openAiDressMeModel: parsed.data.OPENAI_DRESS_ME_MODEL,
});

export function assertRuntimeConfiguration(): void {
  if (env.nodeEnv !== 'test' && !env.mongoUri) {
    throw new Error('MONGODB_URI is required when running the Wardrope API.');
  }

  if (env.nodeEnv !== 'test' && !env.weatherApiKey) {
    throw new Error(
      'WEATHER_API_KEY is required when running the Wardrope API.',
    );
  }

  const hasOpenAiKey = Boolean(env.openAiApiKey);
  const hasOpenAiModel = Boolean(env.openAiDressMeModel);
  if (hasOpenAiKey !== hasOpenAiModel) {
    throw new Error(
      'OPENAI_API_KEY and OPENAI_DRESS_ME_MODEL must be configured together.',
    );
  }

  if (env.nodeEnv === 'production') {
    if (
      env.corsOrigins.length === 0 ||
      env.corsOrigins.some((origin) => origin.includes('localhost'))
    ) {
      throw new Error(
        'CORS_ORIGINS must contain explicit production origins in production.',
      );
    }
  }
}
