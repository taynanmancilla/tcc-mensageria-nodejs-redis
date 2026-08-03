import { performance } from 'node:perf_hooks';
import { messagesReceived, messageLatency } from '../common/metrics.js';

export async function subscribe(mainClient, channel, expectedCount, opts = {}) {
  const {
    scenario  = 'prototype',
    timeoutMs = 0,
  } = opts;

  const sub = mainClient.duplicate();
  await sub.connect();

  const isPrototype = timeoutMs === 0;
  const logEvery    = isPrototype ? 1 : Math.max(1, Math.floor(expectedCount / 10));

  let received = 0;
  let resolveP;
  const done = new Promise((res) => { resolveP = res; });

  let timeoutHandle;
  if (timeoutMs > 0) {
    timeoutHandle = setTimeout(() => {
      console.warn(`[pubsub:subscriber] timeout — ${received}/${expectedCount} recebidas`);
      resolveP(received);
    }, timeoutMs);
  }

  await sub.subscribe(channel, (message) => {
    const data = JSON.parse(message);
    const latencySeconds = (performance.now() - data.timestamp) / 1000;

    messageLatency.observe({ model: 'pubsub', scenario }, latencySeconds);
    messagesReceived.inc({ model: 'pubsub', scenario });

    received++;

    if (isPrototype) {
      console.log(`[pubsub:subscriber] recebida ${received}/${expectedCount} — latência: ${(latencySeconds * 1000).toFixed(3)}ms`);
    } else if (received % logEvery === 0 || received === expectedCount) {
      console.log(`[pubsub:subscriber] ${Math.round((received / expectedCount) * 100)}% (${received}/${expectedCount})`);
    }

    if (received >= expectedCount) {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      resolveP(received);
    }
  });

  const unsubscribe = async () => {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    await sub.unsubscribe(channel);
    await sub.quit();
  };

  return { done, unsubscribe };
}
