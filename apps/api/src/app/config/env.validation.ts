export interface AppEnv {
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  PORT: string;
  CORS_ORIGIN: string;
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
  };
}
