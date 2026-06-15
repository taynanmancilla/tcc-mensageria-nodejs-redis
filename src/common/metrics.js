import { Registry, collectDefaultMetrics, Histogram, Counter, Gauge } from 'prom-client';
import http from 'node:http';
import { config } from './config.js';

export const registry = new Registry();

collectDefaultMetrics({ register: registry });

// Latência — expõe _bucket/_count/_sum; use histogram_quantile() no PromQL para p50, p95, p99
export const messageLatency = new Histogram({
  name: 'tcc_message_latency_seconds',
  help: 'Latência entre envio e recebimento de mensagem',
  labelNames: ['model', 'scenario'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [registry],
});

// --- Throughput ---
export const messagesSent = new Counter({
  name: 'tcc_messages_sent_total',
  help: 'Total de mensagens enviadas',
  labelNames: ['model', 'scenario'],
  registers: [registry],
});

export const messagesReceived = new Counter({
  name: 'tcc_messages_received_total',
  help: 'Total de mensagens recebidas',
  labelNames: ['model', 'scenario'],
  registers: [registry],
});

// --- Confiabilidade ---
export const messagesLost = new Counter({
  name: 'tcc_messages_lost_total',
  help: 'Mensagens descartadas por ausência de subscriber ativo (Pub/Sub)',
  labelNames: ['model', 'scenario'],
  registers: [registry],
});

export const messagesRedelivered = new Counter({
  name: 'tcc_messages_redelivered_total',
  help: 'Mensagens reentregues após falha ou timeout (P2P / Streams)',
  labelNames: ['model', 'scenario'],
  registers: [registry],
});

// --- Profundidade de fila ---
export const queueDepth = new Gauge({
  name: 'tcc_queue_depth',
  help: 'Mensagens aguardando processamento no stream ou canal',
  labelNames: ['model', 'scenario'],
  registers: [registry],
});

export function startMetricsServer() {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/metrics' && req.method === 'GET') {
      res.setHeader('Content-Type', registry.contentType);
      res.end(await registry.metrics());
    } else {
      res.writeHead(404).end();
    }
  });

  server.listen(config.metrics.port, () => {
    console.log(`[metrics] server listening on http://localhost:${config.metrics.port}/metrics`);
  });

  return server;
}
