import 'dotenv/config';

const password = process.env.REDIS_PASSWORD ?? '';

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password,
  },
  metrics: {
    port: Number(process.env.METRICS_PORT ?? 3001),
  },
};
