const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z
    .string()
    .url()
    .default('postgres://postgres:dev@localhost:5432/widget_platform'),
  JWT_SECRET: z.string().min(16).default('replace-with-local-development-secret'),
  GEO_PROVIDER_A_MODE: z.enum(['real', 'success', 'fail']).default('real'),
  GEO_PROVIDER_B_MODE: z.enum(['real', 'success', 'fail']).default('real'),
  SIDE_EFFECT_MODE: z.enum(['success', 'fail']).default('success'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),
  PUBLIC_DEMO_ORIGIN: z.string().url().default('http://localhost:5500'),
  BODY_LIMIT: z.string().default('16kb'),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1000)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const message = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid environment: ${message}`);
}

module.exports = {
  env: parsed.data
};

