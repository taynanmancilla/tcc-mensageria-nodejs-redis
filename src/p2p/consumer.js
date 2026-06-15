import { messagesReceived, messageLatency } from '../common/metrics.js';

export async function setupGroup(client, streamName, groupName) {
  try {
    await client.xGroupCreate(streamName, groupName, '$', { MKSTREAM: true });
  } catch (err) {
    if (!err.message.includes('BUSYGROUP')) throw err;
  }
}

export async function consume(client, streamName, groupName, consumerName, expectedCount) {
  let received = 0;

  while (received < expectedCount) {
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
        const latencySeconds = (Date.now() - Number(data.timestamp)) / 1000;

        messageLatency.observe({ model: 'p2p', scenario: 'prototype' }, latencySeconds);
        messagesReceived.inc({ model: 'p2p', scenario: 'prototype' });
        await client.xAck(streamName, groupName, id);

        received++;
        console.log(`[p2p:consumer] recebida ${received}/${expectedCount} — latência: ${(latencySeconds * 1000).toFixed(2)}ms`);

        if (received >= expectedCount) break;
      }
      if (received >= expectedCount) break;
    }
  }

  return received;
}
