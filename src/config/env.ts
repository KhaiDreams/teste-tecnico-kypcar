import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  PROCESSING_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  WEBHOOK_BASE_URL: z.string().url().default('http://localhost:3000'),
  AUTO_REGISTER_WEBHOOK: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  // Kypcar API — credentials used to obtain a bearer token dynamically at runtime.
  KYPCAR_API_URL: z.string().url().default('https://dev.api.kypcar.com'),
  KYPCAR_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  KYPCAR_RETRY_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  KYPCAR_RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().default(250),
  KYPCAR_EMAIL: z.string().email().optional(),
  KYPCAR_PASSWORD: z.string().min(1).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

export const env = parsed.data;
