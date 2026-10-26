import { z } from 'zod';

const redisUrlSchema = z
  .string()
  .url('deve ser uma URL válida')
  .refine((value) => ['redis:', 'rediss:'].includes(new URL(value).protocol), {
    message: 'deve usar o protocolo redis:// ou rediss://',
  });

const databaseUrlSchema = z
  .string()
  .url('deve ser uma URL válida')
  .refine((value) => ['postgres:', 'postgresql:'].includes(new URL(value).protocol), {
    message: 'deve usar o protocolo postgres:// ou postgresql://',
  });

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  JWT_SECRET: z.string().trim().min(32),

  DATABASE_URL: databaseUrlSchema,

  REDIS_URL: redisUrlSchema,
});

export function validateEnv(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'ambiente'}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Erro na configuração das variáveis de ambiente:\n${errors}`,
    );
  }

  return result.data;
}
