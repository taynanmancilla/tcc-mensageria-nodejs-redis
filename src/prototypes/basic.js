import { connect, disconnect, getClient } from '../common/redis.js';
import { startMetricsServer } from '../common/metrics.js';
import { produce } from '../p2p/producer.js';
import { setupGroup, consume } from '../p2p/consumer.js';
import { publish } from '../pubsub/publisher.js';
import { subscribe } from '../pubsub/subscriber.js';

const MESSAGE_COUNT = 20;
const P2P_STREAM    = 'tcc:p2p:stream';
const P2P_GROUP     = 'tcc-group';
const P2P_CONSUMER  = 'worker-1';
const PUBSUB_CHANNEL = 'tcc:pubsub:channel';

const server = startMetricsServer();
await connect();
const client = getClient();

console.log('\n' + '='.repeat(60));
console.log('TCC — Protótipo Básico (Semana 12)');
console.log('P2P vs Pub/Sub — Node.js + Redis');
console.log('='.repeat(60));

// ── Fluxo P2P ─────────────────────────────────────────────────────
console.log('\n[P2P] Iniciando fluxo P2P (Redis Streams)...\n');
const p2pStart = Date.now();

await client.del(P2P_STREAM);
await setupGroup(client, P2P_STREAM, P2P_GROUP);

const [, receivedP2P] = await Promise.all([
  produce(client, P2P_STREAM, MESSAGE_COUNT),
  consume(client, P2P_STREAM, P2P_GROUP, P2P_CONSUMER, MESSAGE_COUNT),
]);

const p2pDuration = ((Date.now() - p2pStart) / 1000).toFixed(2);

// ── Fluxo Pub/Sub ──────────────────────────────────────────────────
console.log('\n[Pub/Sub] Iniciando fluxo Pub/Sub (Redis Pub/Sub)...\n');
const pubsubStart = Date.now();

const { done, unsubscribe } = await subscribe(client, PUBSUB_CHANNEL, MESSAGE_COUNT);
await publish(client, PUBSUB_CHANNEL, MESSAGE_COUNT);
const receivedPubSub = await done;
await unsubscribe();

const pubsubDuration = ((Date.now() - pubsubStart) / 1000).toFixed(2);

// ── Resumo ─────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(60));
console.log('Resumo');
console.log('='.repeat(60));
console.log(`P2P     | ${MESSAGE_COUNT} enviadas | ${receivedP2P} recebidas | ${p2pDuration}s`);
console.log(`Pub/Sub | ${MESSAGE_COUNT} enviadas | ${receivedPubSub} recebidas | ${pubsubDuration}s`);
console.log('');
console.log('Métricas:   http://localhost:3001/metrics');
console.log('Prometheus: http://localhost:9090/graph');
console.log('\nAguardando Ctrl+C para encerrar...');

process.on('SIGINT', async () => {
  console.log('\n[prototype] Encerrando...');
  await disconnect();
  server.close();
  process.exit(0);
});
