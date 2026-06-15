import { createClient } from 'redis';
import { config } from './config.js';

let client = null;

export async function connect() {
  client = createClient({
    socket: {
      host: config.redis.host,
      port: config.redis.port,
    },
    password: config.redis.password || undefined,
  });

  client.on('error', (err) => {
    console.error('[redis] error:', err.message);
  });

  await client.connect();
  console.log(`[redis] connected — ${config.redis.host}:${config.redis.port}`);
  return client;
}

export function getClient() {
  if (!client) {
    throw new Error('[redis] client not initialized — call connect() first');
  }
  return client;
}

export async function disconnect() {
  if (client) {
    await client.quit();
    client = null;
    console.log('[redis] disconnected');
  }
}
