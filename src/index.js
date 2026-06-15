import { connect, disconnect } from './common/redis.js';
import { startMetricsServer } from './common/metrics.js';

const server = startMetricsServer();
await connect();

process.on('SIGINT', async () => {
  await disconnect();
  server.close();
  process.exit(0);
});
