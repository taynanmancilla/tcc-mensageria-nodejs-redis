# Arquitetura do Experimento

> Documento em elaboração — descreve a arquitetura planejada para o TCC.

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

Componente Node.js customizado responsável por injetar carga controlada no sistema. Permite definir taxa de mensagens por segundo, duração do experimento e cenário a ser executado.

### Coletor de Métricas (`prom-client`)

Biblioteca integrada aos produtores e consumidores para expor métricas no formato Prometheus (latência, throughput, contadores de erro, etc.).

### Prometheus

Servidor de coleta e armazenamento de métricas. Realiza scraping periódico dos endpoints expostos pelos componentes Node.js.

### Grafana

Interface de visualização das métricas coletadas pelo Prometheus. Permite a criação de dashboards comparativos entre os dois modelos.

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

- Todos os componentes serão executados via Docker Compose.
- A arquitetura será detalhada à medida que a implementação avançar.
