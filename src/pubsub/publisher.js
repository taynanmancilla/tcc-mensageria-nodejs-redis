import { messagesSent } from '../common/metrics.js';

export async function publish(client, channel, count) {
  console.log(`[pubsub:publisher] publicando ${count} mensagens → ${channel}`);

  for (let i = 0; i < count; i++) {
    const payload = JSON.stringify({ seq: i, timestamp: Date.now() });
    await client.publish(channel, payload);
    messagesSent.inc({ model: 'pubsub', scenario: 'prototype' });
    console.log(`[pubsub:publisher] publicada ${i + 1}/${count}`);
  }
}
