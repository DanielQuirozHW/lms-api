import type { Env } from './env.validation';

export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  apiPrefix: string;
  database: {
    url: string;
  };
  redis: {
    host: string;
    port: number;
    password: string | undefined;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  cors: {
    origins: string[];
  };
  throttle: {
    ttl: number;
    limit: number;
  };
  r2: {
    accountId: string | undefined;
    accessKeyId: string | undefined;
    secretAccessKey: string | undefined;
    bucketName: string;
    publicUrl: string | undefined;
  };
}

export const configuration = (env: Env): AppConfig => ({
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  apiPrefix: env.API_PREFIX,

  database: {
    url: env.DATABASE_URL,
  },

  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
  },

  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshSecret: env.JWT_REFRESH_SECRET,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },

  cors: {
    origins: env.CORS_ORIGINS.split(',').map((o): string => o.trim()),
  },

  throttle: {
    ttl: env.THROTTLE_TTL,
    limit: env.THROTTLE_LIMIT,
  },

  r2: {
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucketName: env.R2_BUCKET_NAME,
    publicUrl: env.R2_PUBLIC_URL,
  },
});
