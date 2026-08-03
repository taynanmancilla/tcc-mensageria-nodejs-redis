import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { connect, getClient } from '../common/redis.js';
import { startMetricsServer, messageLatency, messagesReceived } from '../common/metrics.js';
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
  if ((scenario.consumers ?? 1) > 1) console.log(`Consumers:   ${scenario.consumers}`);
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

  printSummary(results);

  return { server };
}

async function runP2P(client, scenario, { totalMessages, timeoutMs }) {
  const { id, rate, duration, messageSize } = scenario;
  const numConsumers = scenario.consumers ?? 1;
  const stream = `tcc:p2p:${id}`;
  const group  = `${id}-group`;

  const workerLabel = numConsumers === 1 ? '1 worker' : `${numConsumers} workers`;
  console.log(`\n[P2P] Iniciando — ${totalMessages} msgs a ${rate} msg/s por ${duration}s | ${workerLabel}`);
  const wallStart = Date.now();

  await client.del(stream);
  await setupGroup(client, stream, group);

  if (numConsumers === 1) {
    // Single-consumer path — delegates entirely to consume() (C1 behavior preserved)
    const [sentP2P, receivedP2P] = await Promise.all([
      produce(client, stream, totalMessages, { rate, scenario: id, messageSize }),
      consume(client, stream, group, 'worker-1', totalMessages, { scenario: id, timeoutMs }),
    ]);

    const elapsed = ((Date.now() - wallStart) / 1000).toFixed(2);
    console.log(`[P2P] Concluído — ${sentP2P} enviadas | ${receivedP2P} recebidas | ${elapsed}s`);

    return { sent: sentP2P, received: receivedP2P, elapsed };
  }

  // Multi-consumer path — sharedState coordinates when all workers stop.
  // JavaScript is single-threaded: increments inside the synchronous inner loop
  // are safe without locks — no other coroutine can interleave mid-increment.
  const workerNames  = Array.from({ length: numConsumers }, (_, i) => `worker-${i + 1}`);
  const sharedState  = { total: 0, target: totalMessages };
  const logEvery     = Math.max(1, Math.floor(totalMessages / 10));

  const [sentP2P, ...workerCounts] = await Promise.all([
    produce(client, stream, totalMessages, { rate, scenario: id, messageSize }),
    ...workerNames.map(name =>
      runWorker(client, stream, group, name, id, sharedState, logEvery, timeoutMs),
    ),
  ]);

  const receivedP2P = workerCounts.reduce((sum, n) => sum + n, 0);
  const elapsed = ((Date.now() - wallStart) / 1000).toFixed(2);

  console.log(`[P2P] Concluído — ${sentP2P} enviadas | ${receivedP2P} recebidas | ${elapsed}s`);

  return {
    sent:     sentP2P,
    received: receivedP2P,
    elapsed,
    workers:  Object.fromEntries(workerNames.map((name, i) => [name, workerCounts[i]])),
  };
}

// Worker coroutine for multi-consumer P2P.
// Uses a shared mutable object so all workers stop as soon as the aggregate
// received count reaches the target — avoiding individual-count deadlocks.
async function runWorker(client, streamName, groupName, workerName, scenario, sharedState, logEvery, timeoutMs) {
  const workerClient = client.duplicate();
  await workerClient.connect();

  const deadline = Date.now() + timeoutMs;
  let received = 0;

  try {
    while (sharedState.total < sharedState.target) {
      if (Date.now() > deadline) {
        console.warn(`[p2p:${workerName}] timeout — ${received} mensagens recebidas`);
        break;
      }

      const results = await workerClient.xReadGroup(
        groupName,
        workerName,
        [{ key: streamName, id: '>' }],
        { COUNT: 10, BLOCK: 1000 },
      );

      if (!results) continue;

      for (const { messages } of results) {
        for (const { id, message } of messages) {
          const data = JSON.parse(message.payload);
          const latencySeconds = (performance.now() - data.timestamp) / 1000;

          messageLatency.observe({ model: 'p2p', scenario }, latencySeconds);
          messagesReceived.inc({ model: 'p2p', scenario });
          await workerClient.xAck(streamName, groupName, id);

          received++;
          sharedState.total++;

          if (sharedState.total % logEvery === 0 || sharedState.total === sharedState.target) {
            console.log(`[p2p:${workerName}] ${Math.round((sharedState.total / sharedState.target) * 100)}% (${sharedState.total}/${sharedState.target})`);
          }

          if (sharedState.total >= sharedState.target) break;
        }
        if (sharedState.total >= sharedState.target) break;
      }
    }
  } finally {
    await workerClient.quit();
  }

  return received;
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

function printSummary(results) {
  const sep = '='.repeat(60);
  console.log('\n' + sep);
  console.log('Resumo');
  console.log(sep);

  for (const [model, r] of Object.entries(results)) {
    const label = model === 'p2p' ? 'P2P    ' : 'Pub/Sub';
    const loss  = (((r.sent - r.received) / r.sent) * 100).toFixed(1);
    console.log(`${label} | ${r.sent} env | ${r.received} rec | perda: ${loss}% | ${r.elapsed}s`);

    if (r.workers) {
      for (const [worker, count] of Object.entries(r.workers)) {
        const pct = r.received > 0 ? ((count / r.received) * 100).toFixed(1) : '0.0';
        console.log(`         ${worker}: ${count} msgs (${pct}%)`);
      }
    }
  }

  console.log('');
  console.log('Nota: P2P e Pub/Sub executados em sequência (isolamento de modelos).');
  console.log('');
  console.log('Métricas:   http://localhost:3001/metrics');
  console.log('Prometheus: http://localhost:9090/graph');
  console.log('\nAguardando Ctrl+C para encerrar...');
}
