import { messagesReceived, messageLatency } from '../common/metrics.js';

export async function subscribe(mainClient, channel, expectedCount) {
  const sub = mainClient.duplicate();
  await sub.connect();

  let received = 0;
  let resolve;
  const done = new Promise((res) => { resolve = res; });

  await sub.subscribe(channel, (message) => {
    const data = JSON.parse(message);
    const latencySeconds = (Date.now() - Number(data.timestamp)) / 1000;

    messageLatency.observe({ model: 'pubsub', scenario: 'prototype' }, latencySeconds);
    messagesReceived.inc({ model: 'pubsub', scenario: 'prototype' });

    received++;
    console.log(`[pubsub:subscriber] recebida ${received}/${expectedCount} — latência: ${(latencySeconds * 1000).toFixed(2)}ms`);

    if (received >= expectedCount) resolve(received);
  });

  const unsubscribe = async () => {
    await sub.unsubscribe(channel);
    await sub.quit();
  };

  return { done, unsubscribe };
}
