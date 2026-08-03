export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Yields index i at most `rate` times per second.
// When rate is Infinity (prototype mode), yields immediately with no sleep.
export async function* rateTicker(rate, totalCount) {
  const intervalMs = 1000 / rate;
  for (let i = 0; i < totalCount; i++) {
    const tickStart = Date.now();
    yield i;
    const elapsed = Date.now() - tickStart;
    const wait = intervalMs - elapsed;
    if (wait > 0) await sleep(wait);
  }
}

// Builds a padding string so the JSON payload approximates messageSize bytes.
// Uses a sample payload to estimate base overhead; not exact byte-for-byte.
export function buildPadding(messageSize) {
  if (!messageSize) return '';
  const sampleJson = JSON.stringify({ seq: 9999, timestamp: 99999.999, p: '' });
  const paddingSize = Math.max(0, messageSize - sampleJson.length);
  return 'x'.repeat(paddingSize);
}
