export interface AppEnv {
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  PORT: string;
  CORS_ORIGIN: string;
  APP_URL: string;
  RESEND_API_KEY: string;
  FROM_EMAIL: string;
  OPENAI_API_KEY: string;
  LLM_PROVIDER: string;
  OPENAI_MODEL: string;
  EMBEDDING_PROVIDER: string;
  EMBEDDING_MODEL: string;
  MAX_CHAT_REQUESTS_PER_MINUTE: number;
  CANARY_TOKEN: string;
  // Per-IP rate limit applied to the public/abuse-prone auth + invite routes.
  AUTH_RATE_LIMIT_TTL_SECONDS: number;
  AUTH_RATE_LIMIT_MAX: number;
  // Higher per-IP rate limit for the authenticated POST /invitations create
  // route, so bulk team onboarding from a shared NAT/proxy IP is not throttled
  // at the tighter public-auth limit.
  INVITE_RATE_LIMIT_TTL_SECONDS: number;
  INVITE_RATE_LIMIT_MAX: number;
  // Per-account brute-force protection on POST /auth/login.
  LOGIN_MAX_FAILED_ATTEMPTS: number;
  LOGIN_LOCKOUT_SECONDS: number;
  // Express 'trust proxy' setting so the throttler keys on the real client IP
  // behind a reverse proxy / load balancer / ingress. Boolean, hop count, or a
  // verbatim Express value (e.g. 'loopback', a CIDR/subnet). Defaults to 1
  // (trust a single proxy hop) so X-Forwarded-For cannot be spoofed.
  TRUST_PROXY: boolean | number | string;
  ATTACHMENT_STORAGE_PROVIDER: 'local' | 'cloudinary';
  ATTACHMENT_STORAGE_DIR: string;
  CLOUDINARY_URL: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
}

function normalizeTrustProxy(value: unknown): boolean | number | string {
  if (value === undefined || value === null) {
    return 1;
  }
  const raw = String(value).trim();
  if (raw === '') {
    return false;
  }
  const lower = raw.toLowerCase();
  if (lower === 'true') {
    return true;
  }
  if (lower === 'false') {
    return false;
  }
  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }
  return raw;
}

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const required = ['DATABASE_URL', 'JWT_SECRET'] as const;

  for (const key of required) {
    if (!config[key]) {
      throw new Error(`Missing required env var: ${key}`);
    }
  }

  const attachmentStorageProvider = String(
    config.ATTACHMENT_STORAGE_PROVIDER ?? 'local',
  ).toLowerCase();
  if (
    attachmentStorageProvider !== 'local' &&
    attachmentStorageProvider !== 'cloudinary'
  ) {
    throw new Error(
      `Invalid ATTACHMENT_STORAGE_PROVIDER: ${attachmentStorageProvider} (expected 'local' or 'cloudinary')`,
    );
  }

  if (attachmentStorageProvider === 'cloudinary') {
    const hasExplicitCredentials =
      config.CLOUDINARY_CLOUD_NAME &&
      config.CLOUDINARY_API_KEY &&
      config.CLOUDINARY_API_SECRET;
    if (!config.CLOUDINARY_URL && !hasExplicitCredentials) {
      throw new Error(
        'Cloudinary attachment storage requires CLOUDINARY_URL or all of CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET',
      );
    }
  }

  return {
    DATABASE_URL: String(config.DATABASE_URL),
    JWT_SECRET: String(config.JWT_SECRET),
    JWT_EXPIRES_IN: String(config.JWT_EXPIRES_IN ?? '8h'),
    PORT: String(config.PORT ?? '3000'),
    CORS_ORIGIN: String(config.CORS_ORIGIN ?? 'http://localhost:4200'),
    APP_URL: String(config.APP_URL ?? 'http://localhost:3000'),
    RESEND_API_KEY: String(config.RESEND_API_KEY ?? ''),
    FROM_EMAIL: String(config.FROM_EMAIL ?? 'noreply@example.com'),
    OPENAI_API_KEY: String(config.OPENAI_API_KEY ?? ''),
    LLM_PROVIDER: String(config.LLM_PROVIDER ?? 'openai'),
    OPENAI_MODEL: String(
      config.OPENAI_MODEL ?? config.LLM_MODEL ?? 'gpt-4o-mini',
    ),
    EMBEDDING_PROVIDER: String(config.EMBEDDING_PROVIDER ?? 'openai'),
    EMBEDDING_MODEL: String(config.EMBEDDING_MODEL ?? 'text-embedding-3-small'),
    MAX_CHAT_REQUESTS_PER_MINUTE: Number(
      config.MAX_CHAT_REQUESTS_PER_MINUTE ?? 20,
    ),
    CANARY_TOKEN: String(config.CANARY_TOKEN ?? '__SYSTEM_BOUNDARY_42__'),
    AUTH_RATE_LIMIT_TTL_SECONDS: Number(
      config.AUTH_RATE_LIMIT_TTL_SECONDS ?? 60,
    ),
    AUTH_RATE_LIMIT_MAX: Number(config.AUTH_RATE_LIMIT_MAX ?? 10),
    INVITE_RATE_LIMIT_TTL_SECONDS: Number(
      config.INVITE_RATE_LIMIT_TTL_SECONDS ?? 60,
    ),
    INVITE_RATE_LIMIT_MAX: Number(config.INVITE_RATE_LIMIT_MAX ?? 50),
    LOGIN_MAX_FAILED_ATTEMPTS: Number(config.LOGIN_MAX_FAILED_ATTEMPTS ?? 5),
    LOGIN_LOCKOUT_SECONDS: Number(config.LOGIN_LOCKOUT_SECONDS ?? 900),
    TRUST_PROXY: normalizeTrustProxy(config.TRUST_PROXY),
    ATTACHMENT_STORAGE_PROVIDER: attachmentStorageProvider,
    ATTACHMENT_STORAGE_DIR: String(config.ATTACHMENT_STORAGE_DIR ?? ''),
    CLOUDINARY_URL: String(config.CLOUDINARY_URL ?? ''),
    CLOUDINARY_CLOUD_NAME: String(config.CLOUDINARY_CLOUD_NAME ?? ''),
    CLOUDINARY_API_KEY: String(config.CLOUDINARY_API_KEY ?? ''),
    CLOUDINARY_API_SECRET: String(config.CLOUDINARY_API_SECRET ?? ''),
  };
}
