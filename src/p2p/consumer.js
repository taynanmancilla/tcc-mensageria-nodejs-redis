import { performance } from 'node:perf_hooks';
import { messagesReceived, messageLatency } from '../common/metrics.js';

export async function setupGroup(client, streamName, groupName) {
  try {
    await client.xGroupCreate(streamName, groupName, '$', { MKSTREAM: true });
  } catch (err) {
    if (!err.message.includes('BUSYGROUP')) throw err;
  }
}

export async function consume(mainClient, streamName, groupName, consumerName, expectedCount, opts = {}) {
  const {
    scenario  = 'prototype',
    timeoutMs = 0,
  } = opts;

  // XREADGROUP BLOCK retém a conexão TCP no servidor por até o timeout definido.
  // Uma conexão dedicada evita que XADD do produtor fique enfileirado atrás do BLOCK.
  const client = mainClient.duplicate();
  await client.connect();

  const isPrototype = timeoutMs === 0;
  const logEvery    = isPrototype ? 1 : Math.max(1, Math.floor(expectedCount / 10));
  const deadline    = timeoutMs > 0 ? Date.now() + timeoutMs : Infinity;

  let received = 0;

  try {
    while (received < expectedCount) {
      if (Date.now() > deadline) {
        console.warn(`[p2p:consumer] timeout — ${received}/${expectedCount} recebidas`);
        break;
      }

      const results = await client.xReadGroup(
        groupName,
        consumerName,
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
          await client.xAck(streamName, groupName, id);

          received++;

          if (isPrototype) {
            console.log(`[p2p:consumer] recebida ${received}/${expectedCount} — latência: ${(latencySeconds * 1000).toFixed(3)}ms`);
          } else if (received % logEvery === 0 || received === expectedCount) {
            console.log(`[p2p:consumer] ${Math.round((received / expectedCount) * 100)}% (${received}/${expectedCount})`);
          }

          if (received >= expectedCount) break;
        }
        if (received >= expectedCount) break;
      }
    }
  } finally {
    await client.quit();
  }

  return received;
}
