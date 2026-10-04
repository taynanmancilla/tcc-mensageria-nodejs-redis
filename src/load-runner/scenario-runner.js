import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { connect, getClient } from '../common/redis.js';
import { startMetricsServer, messageLatency, messagesReceived, messagesRedelivered, messagesSent, messagesLost } from '../common/metrics.js';
import { produce } from '../p2p/producer.js';
import { setupGroup, consume } from '../p2p/consumer.js';
import { publish } from '../pubsub/publisher.js';
import { subscribe } from '../pubsub/subscriber.js';

// Divides `total` into `n` integer parts, distributing the remainder across the first parts.
function splitLoad(total, n) {
  const base = Math.floor(total / n);
  const remainder = total % n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}

// Reads the current value of a Prometheus counter for a specific label combination,
// without resetting or mutating it — used by C5 to observe sent/received progress
// mid-run (e.g. around a simulated failure window) without needing subscribe()/
// publish() to expose any new return value.
async function readCounterValue(counter, labels) {
  const data = await counter.get();
  const entry = data.values.find((v) =>
    Object.keys(labels).every((key) => v.labels[key] === labels[key]),
  );
  return entry ? entry.value : 0;
}

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
  if ((scenario.subscribers ?? 1) > 1) console.log(`Subscribers: ${scenario.subscribers}`);
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
  const numProducers = scenario.producers ?? 1;
  const stream = `tcc:p2p:${id}`;
  const group  = `${id}-group`;

  const workerLabel = numConsumers === 1 ? '1 worker' : `${numConsumers} workers`;
  const producerPrefix = numProducers > 1 ? `${numProducers} producers → ` : '';
  console.log(`\n[P2P] Iniciando — ${totalMessages} msgs a ${rate} msg/s por ${duration}s | ${producerPrefix}${workerLabel}`);
  const wallStart = Date.now();

  await client.del(stream);
  await setupGroup(client, stream, group);

  if (numConsumers === 1 && numProducers === 1) {
    // Single-producer, single-consumer path — delegates entirely to produce()/consume() (C1 behavior preserved)
    const [sentP2P, receivedP2P] = await Promise.all([
      produce(client, stream, totalMessages, { rate, scenario: id, messageSize }),
      consume(client, stream, group, 'worker-1', totalMessages, { scenario: id, timeoutMs }),
    ]);

    const elapsed = ((Date.now() - wallStart) / 1000).toFixed(2);
    console.log(`[P2P] Concluído — ${sentP2P} enviadas | ${receivedP2P} recebidas | ${elapsed}s`);

    return { sent: sentP2P, received: receivedP2P, elapsed };
  }

  // Producer side — static split across N producers, no coordination needed
  // (unlike consumers, producers never compete for the same messages).
  let producerNames = null;
  let producerTasks;
  if (numProducers === 1) {
    producerTasks = [produce(client, stream, totalMessages, { rate, scenario: id, messageSize })];
  } else {
    producerNames = Array.from({ length: numProducers }, (_, i) => `producer-${i + 1}`);
    const producerCounts = splitLoad(totalMessages, numProducers);
    const producerRate = rate / numProducers;
    producerTasks = producerNames.map((name, i) =>
      runProducer(client, stream, producerCounts[i], producerRate, id, messageSize),
    );
  }

  // Consumer side — sharedState coordinates when all workers stop (C2 behavior preserved).
  // JavaScript is single-threaded: increments inside the synchronous inner loop
  // are safe without locks — no other coroutine can interleave mid-increment.
  const simulateFailure = scenario.simulateFailure === true;
  let workerNames = null;
  let consumerTasks;
  let recoveryTask = Promise.resolve(0);

  if (numConsumers === 1) {
    consumerTasks = [consume(client, stream, group, 'worker-1', totalMessages, { scenario: id, timeoutMs })];
  } else {
    workerNames = Array.from({ length: numConsumers }, (_, i) => `worker-${i + 1}`);
    const sharedState = { total: 0, target: totalMessages };
    const logEvery = Math.max(1, Math.floor(totalMessages / 10));

    if (simulateFailure) {
      // C5: worker-1 is deliberately crashed mid-batch (after XREADGROUP, before XACK)
      // leaving pending entries in the group's PEL. worker-2+ keep consuming normally
      // via the unmodified runWorker() — the shared sharedState object is what lets
      // them notice the recovery sweep's contribution and stop at the right count,
      // with no changes needed to runWorker() itself.
      const failAtMs = wallStart + scenario.failureAt * 1000;
      const recoverAtMs = wallStart + (scenario.failureAt + scenario.failureDuration) * 1000;

      consumerTasks = [
        runFailingWorker(client, stream, group, workerNames[0], id, sharedState, logEvery, timeoutMs, failAtMs),
        ...workerNames.slice(1).map(name =>
          runWorker(client, stream, group, name, id, sharedState, logEvery, timeoutMs),
        ),
      ];
      recoveryTask = recoverPendingMessages(client, stream, group, workerNames[1], id, sharedState, recoverAtMs);
    } else {
      consumerTasks = workerNames.map(name =>
        runWorker(client, stream, group, name, id, sharedState, logEvery, timeoutMs),
      );
    }
  }

  const [producerCounts, consumerCounts, recoveredCount] = await Promise.all([
    Promise.all(producerTasks),
    Promise.all(consumerTasks),
    recoveryTask,
  ]);

  const sentP2P = producerCounts.reduce((sum, n) => sum + n, 0);
  const receivedP2P = consumerCounts.reduce((sum, n) => sum + n, 0) + recoveredCount;
  const elapsed = ((Date.now() - wallStart) / 1000).toFixed(2);

  console.log(`[P2P] Concluído — ${sentP2P} enviadas | ${receivedP2P} recebidas | ${elapsed}s`);

  const result = { sent: sentP2P, received: receivedP2P, elapsed };
  if (producerNames) {
    result.producers = Object.fromEntries(producerNames.map((name, i) => [name, producerCounts[i]]));
  }
  if (workerNames) {
    result.workers = Object.fromEntries(workerNames.map((name, i) => [name, consumerCounts[i]]));
  }
  if (simulateFailure) {
    const pendingSummary = await client.xPending(stream, group);
    result.redelivered = recoveredCount;
    result.lost = 0;
    result.pendingFinal = pendingSummary.pending;
    result.recoveredMessages = recoveredCount;
  }
  return result;
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

// Failing worker coroutine for C5 (simulateFailure). Reads a batch via XREADGROUP
// exactly like runWorker(), but once failAtMs has passed, abandons that batch
// without ACKing it — leaving it pending in the group's PEL — and disconnects,
// simulating a crash mid-processing. Never increments messagesReceived/latency
// for the abandoned batch: those messages only count once recovered.
async function runFailingWorker(client, streamName, groupName, workerName, scenario, sharedState, logEvery, timeoutMs, failAtMs) {
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

      if (Date.now() >= failAtMs) {
        const abandoned = results.reduce((sum, { messages }) => sum + messages.length, 0);
        console.warn(`[p2p:${workerName}] falha simulada — abandonando lote de ${abandoned} mensagens sem XACK`);
        break;
      }

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

  console.log(`[p2p:${workerName}] encerrado após falha simulada — ${received} mensagens processadas antes da queda`);

  return received;
}

// One-shot recovery sweep for C5. Waits until the failure window has passed, then
// reclaims whatever runFailingWorker() left pending in the PEL via XAUTOCLAIM,
// reassigning it to a healthy worker's consumer identity and ACKing it. A single
// sweep is enough — the abandoned batch is bounded by XREADGROUP's own COUNT (10),
// never by the full failure window's message volume (unlike Pub/Sub's loss).
async function recoverPendingMessages(client, streamName, groupName, recoveryConsumer, scenario, sharedState, recoverAtMs) {
  const recoveryClient = client.duplicate();
  await recoveryClient.connect();

  const waitMs = recoverAtMs - Date.now();
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  let recovered = 0;

  try {
    // minIdleTime=1000ms: the abandoned batch has been idle since failAtMs (tens of
    // seconds by the time this sweep runs), while messages actively being read and
    // ACKed by a healthy worker are idle for only single-digit milliseconds — 1s is
    // a safe, simple threshold that can't accidentally reclaim in-flight messages.
    const { messages } = await recoveryClient.xAutoClaim(
      streamName, groupName, recoveryConsumer, 1000, '0-0', { COUNT: 100 },
    );

    for (const entry of messages) {
      if (!entry) continue; // tombstoned entry (deleted from the stream) — nothing to recover

      const { id, message } = entry;
      const data = JSON.parse(message.payload);
      const latencySeconds = (performance.now() - data.timestamp) / 1000;

      messageLatency.observe({ model: 'p2p', scenario }, latencySeconds);
      messagesReceived.inc({ model: 'p2p', scenario });
      messagesRedelivered.inc({ model: 'p2p', scenario });
      await recoveryClient.xAck(streamName, groupName, id);

      recovered++;
      sharedState.total++;
    }
  } finally {
    await recoveryClient.quit();
  }

  console.log(`[p2p:recovery] ${recovered} mensagens recuperadas via XAUTOCLAIM`);

  return recovered;
}

// Producer coroutine for multi-producer P2P.
// Each producer gets a static, non-overlapping slice of totalMessages — no
// coordination needed between producers, unlike the shared-target consumer side.
async function runProducer(client, streamName, count, rate, scenario, messageSize) {
  const producerClient = client.duplicate();
  await producerClient.connect();

  try {
    return await produce(producerClient, streamName, count, { rate, scenario, messageSize });
  } finally {
    await producerClient.quit();
  }
}

async function runPubSub(client, scenario, { totalMessages, timeoutMs }) {
  const { id, rate, duration, messageSize } = scenario;
  const numSubscribers = scenario.subscribers ?? 1;
  const numPublishers = scenario.producers ?? 1;
  const channel = `tcc:pubsub:${id}`;
  const simulateFailure = scenario.simulateFailure === true;

  const subLabel = numSubscribers === 1 ? '1 subscriber' : `${numSubscribers} subscribers`;
  const publisherPrefix = numPublishers > 1 ? `${numPublishers} publishers → ` : '';
  console.log(`\n[Pub/Sub] Iniciando — ${totalMessages} msgs a ${rate} msg/s por ${duration}s | ${publisherPrefix}${subLabel}`);
  const wallStart = Date.now();

  if (simulateFailure) {
    // C5: dedicated path — a single subscriber is deliberately disconnected for
    // failureDuration seconds. C1/C3/C4 never set simulateFailure, so they never
    // reach this branch and the paths below remain completely unaffected.
    return runPubSubWithFailure(client, scenario, { totalMessages, timeoutMs, channel, wallStart });
  }

  if (numSubscribers === 1 && numPublishers === 1) {
    // Single-publisher, single-subscriber path — delegates entirely to subscribe()/publish() (C1 behavior preserved)
    const { done, unsubscribe } = await subscribe(client, channel, totalMessages, { scenario: id, timeoutMs });
    const sentPubSub = await publish(client, channel, totalMessages, { rate, scenario: id, messageSize });
    const receivedPubSub = await done;
    await unsubscribe();

    const elapsed = ((Date.now() - wallStart) / 1000).toFixed(2);
    console.log(`[Pub/Sub] Concluído — ${sentPubSub} enviadas | ${receivedPubSub} recebidas | ${elapsed}s`);

    return { sent: sentPubSub, received: receivedPubSub, elapsed };
  }

  // Subscriber side — 1 or many (fan-out, C3 behavior preserved when numSubscribers > 1).
  // subscribe() only resolves after Redis confirms the SUBSCRIBE — safe to publish
  // only after every subscriber (1 or many) is ready, regardless of publisher count.
  let subscriberNames = null;
  let subs;
  if (numSubscribers === 1) {
    subs = [await subscribe(client, channel, totalMessages, { scenario: id, timeoutMs })];
  } else {
    subscriberNames = Array.from({ length: numSubscribers }, (_, i) => `subscriber-${i + 1}`);
    subs = await Promise.all(
      subscriberNames.map(() => subscribe(client, channel, totalMessages, { scenario: id, timeoutMs })),
    );
  }

  // Publisher side — static split across N publishers, no coordination needed
  // (mirrors the P2P producer side — publishers never compete for the same messages).
  let publisherNames = null;
  let publisherTasks;
  if (numPublishers === 1) {
    publisherTasks = [publish(client, channel, totalMessages, { rate, scenario: id, messageSize })];
  } else {
    publisherNames = Array.from({ length: numPublishers }, (_, i) => `publisher-${i + 1}`);
    const publisherCounts = splitLoad(totalMessages, numPublishers);
    const publisherRate = rate / numPublishers;
    publisherTasks = publisherNames.map((name, i) =>
      runPublisher(client, channel, publisherCounts[i], publisherRate, id, messageSize),
    );
  }

  const [publisherCounts, receivedCounts] = await Promise.all([
    Promise.all(publisherTasks),
    Promise.all(subs.map((s) => s.done)),
  ]);
  await Promise.all(subs.map((s) => s.unsubscribe()));

  const sentPubSub = publisherCounts.reduce((sum, n) => sum + n, 0);
  const receivedPubSub = receivedCounts.reduce((sum, n) => sum + n, 0);
  const elapsed = ((Date.now() - wallStart) / 1000).toFixed(2);

  const aggregateSuffix = subscriberNames ? ' (agregado)' : '';
  console.log(`[Pub/Sub] Concluído — ${sentPubSub} enviadas | ${receivedPubSub} recebidas${aggregateSuffix} | ${elapsed}s`);

  const result = { sent: sentPubSub, received: receivedPubSub, elapsed };
  if (publisherNames) {
    result.publishers = Object.fromEntries(publisherNames.map((name, i) => [name, publisherCounts[i]]));
  }
  if (subscriberNames) {
    result.subscribers = Object.fromEntries(subscriberNames.map((name, i) => [name, receivedCounts[i]]));
    result.expectedPerSubscriber = totalMessages;
  }
  return result;
}

// C5 (simulateFailure) Pub/Sub path: a single subscriber is forcibly disconnected
// for failureDuration seconds, while the publisher keeps publishing uninterrupted.
// Messages published during that window are permanently lost — Pub/Sub has no
// persistence and no redelivery, unlike the P2P/Streams side of C5.
//
// `lost` is measured as the delta of the live tcc_messages_sent_total counter
// between disconnect and reconnect (readCounterValue), not assumed from
// rate × failureDuration — subscribe()/publish() expose no API for in-progress
// counts, so reading the already-exported Prometheus counters directly is how
// this avoids touching subscriber.js/publisher.js.
async function runPubSubWithFailure(client, scenario, { totalMessages, timeoutMs, channel, wallStart }) {
  const { id, rate, messageSize } = scenario;
  const failAtMs = wallStart + scenario.failureAt * 1000;
  const recoverAtMs = wallStart + (scenario.failureAt + scenario.failureDuration) * 1000;

  // Phase 1: subscribe before publish starts (same ordering guarantee as C1/C3/C4).
  // We never await its `done` — we deliberately disconnect before expectedCount.
  const first = await subscribe(client, channel, totalMessages, { scenario: id, timeoutMs });
  const sentPromise = publish(client, channel, totalMessages, { rate, scenario: id, messageSize });

  const toFailMs = failAtMs - Date.now();
  if (toFailMs > 0) await new Promise((resolve) => setTimeout(resolve, toFailMs));

  const sentAtDisconnect = await readCounterValue(messagesSent, { model: 'pubsub', scenario: id });
  const receivedBeforeFailure = await readCounterValue(messagesReceived, { model: 'pubsub', scenario: id });
  await first.unsubscribe();
  console.warn(`[pubsub:subscriber] falha simulada — desconectado em ${scenario.failureAt}s (${receivedBeforeFailure} recebidas até aqui)`);

  const toRecoverMs = recoverAtMs - Date.now();
  if (toRecoverMs > 0) await new Promise((resolve) => setTimeout(resolve, toRecoverMs));

  const sentAtReconnect = await readCounterValue(messagesSent, { model: 'pubsub', scenario: id });
  const lost = Math.max(0, sentAtReconnect - sentAtDisconnect);
  messagesLost.inc({ model: 'pubsub', scenario: id }, lost);
  console.warn(`[pubsub:subscriber] reconectando em ${scenario.failureAt + scenario.failureDuration}s — ${lost} mensagens perdidas durante a falha`);

  // Phase 2: fresh subscriber, expecting only what's left to be published from here on.
  const remainingAfterReconnect = Math.max(0, totalMessages - sentAtReconnect);
  const second = await subscribe(client, channel, remainingAfterReconnect, { scenario: id, timeoutMs });

  const [sentPubSub, receivedAfterReconnect] = await Promise.all([sentPromise, second.done]);
  await second.unsubscribe();

  const receivedPubSub = receivedBeforeFailure + receivedAfterReconnect;
  const elapsed = ((Date.now() - wallStart) / 1000).toFixed(2);

  console.log(`[Pub/Sub] Concluído — ${sentPubSub} enviadas | ${receivedPubSub} recebidas | ${lost} perdidas | ${elapsed}s`);

  return {
    sent: sentPubSub,
    received: receivedPubSub,
    elapsed,
    lost,
    redelivered: 0,
    failureWindow: `${scenario.failureAt}s–${scenario.failureAt + scenario.failureDuration}s`,
    receivedBeforeFailure,
    receivedAfterReconnect,
    sentAtDisconnect,
    sentAtReconnect,
  };
}

// Publisher coroutine for multi-publisher Pub/Sub.
// Each publisher gets a static, non-overlapping slice of totalMessages — no
// coordination needed between publishers, mirroring the P2P producer side.
async function runPublisher(client, channel, count, rate, scenario, messageSize) {
  const publisherClient = client.duplicate();
  await publisherClient.connect();

  try {
    return await publish(publisherClient, channel, count, { rate, scenario, messageSize });
  } finally {
    await publisherClient.quit();
  }
}

function printSummary(results) {
  const sep = '='.repeat(60);
  console.log('\n' + sep);
  console.log('Resumo');
  console.log(sep);

  for (const [model, r] of Object.entries(results)) {
    const label = model === 'p2p' ? 'P2P    ' : 'Pub/Sub';

    if (r.subscribers) {
      // Fan-out (Pub/Sub, múltiplos subscribers): received agregado = sent × subscribers por design.
      // "Perda" não se aplica ao agregado aqui — cada subscriber é avaliado contra o total publicado.
      const numSubscribers = Object.keys(r.subscribers).length;
      console.log(`${label} | ${r.sent} env | ${r.received} rec (agregado, ${numSubscribers} subscribers × ${r.expectedPerSubscriber} esperado) | ${r.elapsed}s`);

      if (r.producers) {
        for (const [name, count] of Object.entries(r.producers)) {
          console.log(`         ${name}: ${count} msgs`);
        }
      }
      if (r.publishers) {
        for (const [name, count] of Object.entries(r.publishers)) {
          console.log(`         ${name}: ${count} msgs`);
        }
      }
      for (const [name, count] of Object.entries(r.subscribers)) {
        const pct = r.expectedPerSubscriber > 0 ? ((count / r.expectedPerSubscriber) * 100).toFixed(1) : '0.0';
        console.log(`         ${name}: ${count}/${r.expectedPerSubscriber} msgs (${pct}%)`);
      }
      continue;
    }

    const loss = (((r.sent - r.received) / r.sent) * 100).toFixed(1);
    // C5 (simulateFailure): surface redelivered/pendingFinal (P2P) or lost/redelivered
    // (Pub/Sub) alongside the usual loss line — "perda" stays the sent-vs-received
    // discrepancy check, unrelated to the explicit lost/redelivered counters.
    let failureSuffix = '';
    if (r.pendingFinal !== undefined) {
      failureSuffix = ` | redelivered: ${r.redelivered} | pendingFinal: ${r.pendingFinal}`;
    } else if (r.failureWindow !== undefined) {
      failureSuffix = ` | lost: ${r.lost} | redelivered: ${r.redelivered}`;
    }
    console.log(`${label} | ${r.sent} env | ${r.received} rec | perda: ${loss}%${failureSuffix} | ${r.elapsed}s`);

    if (r.producers) {
      for (const [name, count] of Object.entries(r.producers)) {
        console.log(`         ${name}: ${count} msgs`);
      }
    }
    if (r.publishers) {
      for (const [name, count] of Object.entries(r.publishers)) {
        console.log(`         ${name}: ${count} msgs`);
      }
    }
    if (r.workers) {
      for (const [worker, count] of Object.entries(r.workers)) {
        const pct = r.received > 0 ? ((count / r.received) * 100).toFixed(1) : '0.0';
        console.log(`         ${worker}: ${count} msgs (${pct}%)`);
      }
    }
    if (r.recoveredMessages) {
      console.log(`         recuperadas via XAUTOCLAIM: ${r.recoveredMessages}`);
    }
    if (r.failureWindow !== undefined) {
      console.log(`         falha simulada: ${r.failureWindow}`);
      console.log(`         antes da falha: ${r.receivedBeforeFailure} msgs recebidas`);
      console.log(`         após reconexão: ${r.receivedAfterReconnect} msgs recebidas`);
    }
  }

  console.log('');
  console.log('Nota: P2P e Pub/Sub executados em sequência (isolamento de modelos).');
  console.log('');
  console.log('Métricas:   http://localhost:3001/metrics');
  console.log('Prometheus: http://localhost:9090/graph');
  console.log('\nAguardando Ctrl+C para encerrar...');
}
