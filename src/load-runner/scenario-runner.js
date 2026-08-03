import { readFileSync } from 'node:fs';
import { connect, getClient } from '../common/redis.js';
import { startMetricsServer } from '../common/metrics.js';
import { produce } from '../p2p/producer.js';
import { setupGroup, consume } from '../p2p/consumer.js';
import { publish } from '../pubsub/publisher.js';
import { subscribe } from '../pubsub/subscriber.js';

export async function runScenario(scenarioId) {
  const raw = readFileSync(`experiments/scenarios/${scenarioId}.json`, 'utf-8');
  const scenario = JSON.parse(raw);

  const { id, name, model, rate, duration, messageSize } = scenario;
  const totalMessages = rate * duration;
  const timeoutMs = Math.ceil(duration * 1.5 * 1000);

  const sep = '='.repeat(60);
  console.log('\n' + sep);
  console.log(`TCC — ${name}`);
  console.log(sep);
  console.log(`Cenário:     ${id}`);
  console.log(`Rate:        ${rate} msg/s`);
  console.log(`Duration:    ${duration}s`);
  console.log(`Total msgs:  ${totalMessages} por modelo`);
  console.log(`MessageSize: ~${messageSize} bytes`);
  console.log(`Modelo:      ${model}`);
  console.log(sep);

  const server = startMetricsServer();
  await connect();
  const client = getClient();

  const results = {};

  if (model === 'p2p' || model === 'both') {
    results.p2p = await runP2P(client, scenario, { totalMessages, timeoutMs });
  }

  if (model === 'pubsub' || model === 'both') {
    results.pubsub = await runPubSub(client, scenario, { totalMessages, timeoutMs });
  }

  printSummary(results, totalMessages);

  return { server };
}

async function runP2P(client, scenario, { totalMessages, timeoutMs }) {
  const { id, rate, duration, messageSize } = scenario;
  const stream   = `tcc:p2p:${id}`;
  const group    = `${id}-group`;
  const consumer = 'worker-1';

  console.log(`\n[P2P] Iniciando — ${totalMessages} msgs a ${rate} msg/s por ${duration}s`);
  const wallStart = Date.now();

  await client.del(stream);
  await setupGroup(client, stream, group);

  const [sentP2P, receivedP2P] = await Promise.all([
    produce(client, stream, totalMessages, { rate, scenario: id, messageSize }),
    consume(client, stream, group, consumer, totalMessages, { scenario: id, timeoutMs }),
  ]);

  const elapsed = ((Date.now() - wallStart) / 1000).toFixed(2);
  console.log(`[P2P] Concluído — ${sentP2P} enviadas | ${receivedP2P} recebidas | ${elapsed}s`);

  return { sent: sentP2P, received: receivedP2P, elapsed };
}

async function runPubSub(client, scenario, { totalMessages, timeoutMs }) {
  const { id, rate, duration, messageSize } = scenario;
  const channel = `tcc:pubsub:${id}`;

  console.log(`\n[Pub/Sub] Iniciando — ${totalMessages} msgs a ${rate} msg/s por ${duration}s`);
  const wallStart = Date.now();

  const { done, unsubscribe } = await subscribe(client, channel, totalMessages, { scenario: id, timeoutMs });
  const sentPubSub = await publish(client, channel, totalMessages, { rate, scenario: id, messageSize });
  const receivedPubSub = await done;
  await unsubscribe();

  const elapsed = ((Date.now() - wallStart) / 1000).toFixed(2);
  console.log(`[Pub/Sub] Concluído — ${sentPubSub} enviadas | ${receivedPubSub} recebidas | ${elapsed}s`);

  return { sent: sentPubSub, received: receivedPubSub, elapsed };
}

function printSummary(results, totalMessages) {
  const sep = '='.repeat(60);
  console.log('\n' + sep);
  console.log('Resumo');
  console.log(sep);

  for (const [model, r] of Object.entries(results)) {
    const label   = model === 'p2p' ? 'P2P    ' : 'Pub/Sub';
    const loss    = (((r.sent - r.received) / r.sent) * 100).toFixed(1);
    console.log(`${label} | ${r.sent} env | ${r.received} rec | perda: ${loss}% | ${r.elapsed}s`);
  }

  console.log('');
  console.log('Nota: P2P e Pub/Sub executados em sequência (isolamento de modelos).');
  console.log('');
  console.log('Métricas:   http://localhost:3001/metrics');
  console.log('Prometheus: http://localhost:9090/graph');
  console.log('\nAguardando Ctrl+C para encerrar...');
}
