# Arquitetura do Experimento

Documento conceitual que descreve a arquitetura do experimento implementada e validada nos cenários C1–C5.

## Visão Geral

O experimento é composto por múltiplos componentes que interagem entre si para simular dois modelos de mensageria distintos e coletar métricas comparativas.

## Componentes Principais

### Produtores / Publishers

Processos Node.js responsáveis por gerar e enviar mensagens para o Redis. No modelo P2P, o produtor escreve em um Redis Stream. No modelo Pub/Sub, o publisher publica em um canal Redis.

### Consumidores / Subscribers

Processos Node.js responsáveis por ler as mensagens. No modelo P2P, o consumidor lê de um Redis Stream utilizando grupos de consumidores. No modelo Pub/Sub, o subscriber se inscreve em canais e recebe mensagens em tempo real.

### Redis

Camada de mensageria central. Provê:

- **Redis Streams** — para o modelo Point-to-Point (P2P), com suporte a grupos de consumidores e reentrega de mensagens.
- **Redis Pub/Sub** — para o modelo Publish/Subscribe, com entrega imediata e sem persistência.

### Script de Carga (`load-runner`)

Componente Node.js customizado que injeta carga controlada no sistema, rodando localmente (fora do Docker Compose). Lê o cenário a partir de `experiments/scenarios/*.json`, define taxa de mensagens por segundo, duração do experimento e cenário a ser executado, e expõe o endpoint `/metrics` na porta `3001`. Detalhes em [`docs/ferramenta-carga.md`](ferramenta-carga.md).

### Coletor de Métricas (`prom-client`)

Biblioteca integrada ao load-runner para expor métricas no formato Prometheus (latência, throughput, contadores de confiabilidade). Detalhes em [`docs/metricas.md`](metricas.md).

### Prometheus

Servidor de coleta e armazenamento de métricas, executado via Docker Compose. Realiza scraping periódico do endpoint `/metrics` exposto pelo processo Node.js — o target `nodejs-app` aparece como UP sempre que esse processo está em execução.

### Grafana

Interface de visualização das métricas coletadas pelo Prometheus, executado via Docker Compose. A criação de dashboards comparativos entre os dois modelos ainda é uma pendência (ver [`README.md`](../README.md), seção "Próximos Passos").

## Diagrama Simplificado

```
┌─────────────┐         ┌─────────────────────┐         ┌──────────────┐
│  load-runner │ ──────▶ │       Redis          │ ──────▶ │  Consumidor  │
│  (produtor) │         │  Streams / Pub/Sub   │         │ /Subscriber  │
└─────────────┘         └─────────────────────┘         └──────────────┘
       │                                                        │
       └──────────────────── prom-client ─────────────────────┘
                                    │
                             ┌──────▼──────┐
                             │ Prometheus  │
                             └──────┬──────┘
                                    │
                             ┌──────▼──────┐
                             │   Grafana   │
                             └─────────────┘
```

## Observações

- Redis, Prometheus e Grafana são executados via Docker Compose (`docker-compose.yml`, `npm run docker:up`).
- O processo Node.js (protótipo ou qualquer cenário `scenario:c1`–`c5`) roda localmente, fora do Docker Compose, e expõe `/metrics` na porta `3001` para ser raspado pelo Prometheus.
- A implementação e validação dos cenários C1–C5 estão documentadas no [`README.md`](../README.md) principal e nos registros locais de `docs/implementation-log/`.
