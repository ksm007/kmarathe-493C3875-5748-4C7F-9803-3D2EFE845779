export interface AppEnv {
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  PORT: string;
  CORS_ORIGIN: string;
  OPENAI_API_KEY: string;
  LLM_PROVIDER: string;
  OPENAI_MODEL: string;
  EMBEDDING_PROVIDER: string;
  EMBEDDING_MODEL: string;
  MAX_CHAT_REQUESTS_PER_MINUTE: number;
  CANARY_TOKEN: string;
}

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const required = ['DATABASE_URL', 'JWT_SECRET'] as const;

  for (const key of required) {
    if (!config[key]) {
      throw new Error(`Missing required env var: ${key}`);
    }
  }

  return {
    DATABASE_URL: String(config.DATABASE_URL),
    JWT_SECRET: String(config.JWT_SECRET),
    JWT_EXPIRES_IN: String(config.JWT_EXPIRES_IN ?? '8h'),
    PORT: String(config.PORT ?? '3000'),
    CORS_ORIGIN: String(config.CORS_ORIGIN ?? 'http://localhost:4200'),
    OPENAI_API_KEY: String(config.OPENAI_API_KEY ?? ''),
    LLM_PROVIDER: String(config.LLM_PROVIDER ?? 'openai'),
    OPENAI_MODEL: String(config.OPENAI_MODEL ?? config.LLM_MODEL ?? 'gpt-4o-mini'),
    EMBEDDING_PROVIDER: String(config.EMBEDDING_PROVIDER ?? 'openai'),
    EMBEDDING_MODEL: String(config.EMBEDDING_MODEL ?? 'text-embedding-3-small'),
    MAX_CHAT_REQUESTS_PER_MINUTE: Number(config.MAX_CHAT_REQUESTS_PER_MINUTE ?? 20),
    CANARY_TOKEN: String(config.CANARY_TOKEN ?? '__SYSTEM_BOUNDARY_42__'),
  };
}
