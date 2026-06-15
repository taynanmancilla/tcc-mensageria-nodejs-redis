import { messagesSent } from '../common/metrics.js';

export async function produce(client, streamName, count) {
  console.log(`[p2p:producer] enviando ${count} mensagens → ${streamName}`);

  for (let i = 0; i < count; i++) {
    const payload = JSON.stringify({ seq: i, timestamp: Date.now() });
    await client.xAdd(streamName, '*', { payload });
    messagesSent.inc({ model: 'p2p', scenario: 'prototype' });
    console.log(`[p2p:producer] enviada ${i + 1}/${count}`);
  }
}
