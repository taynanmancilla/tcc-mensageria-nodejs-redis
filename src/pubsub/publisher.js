import { performance } from 'node:perf_hooks';
import { messagesSent } from '../common/metrics.js';
import { rateTicker, buildPadding } from '../load-runner/rate.js';

export async function publish(client, channel, count, opts = {}) {
  const {
    rate     = Infinity,
    scenario = 'prototype',
    messageSize = 0,
  } = opts;

  const isPrototype = rate === Infinity;
  const padding  = buildPadding(messageSize);
  const logEvery = isPrototype ? 1 : Math.max(1, Math.floor(count / 10));
  let sent = 0;

  if (isPrototype) {
    console.log(`[pubsub:publisher] publicando ${count} mensagens → ${channel}`);
  } else {
    console.log(`[pubsub:publisher] iniciando — ${count} msgs a ${rate} msg/s`);
  }

  for await (const i of rateTicker(rate, count)) {
    const payload = JSON.stringify({ seq: i, timestamp: performance.now(), p: padding });
    await client.publish(channel, payload);
    messagesSent.inc({ model: 'pubsub', scenario });
    sent++;

    if (isPrototype) {
      console.log(`[pubsub:publisher] publicada ${sent}/${count}`);
    } else if (sent % logEvery === 0 || sent === count) {
      console.log(`[pubsub:publisher] ${Math.round((sent / count) * 100)}% (${sent}/${count})`);
    }
  }

  return sent;
}
