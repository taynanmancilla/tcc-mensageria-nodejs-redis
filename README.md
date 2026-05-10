# Avaliação Comparativa de Modelos de Mensageria P2P e Pub/Sub com Node.js e Redis

Este repositório contém o projeto experimental desenvolvido para o Trabalho de Conclusão de Curso em Engenharia de Computação, cujo objetivo é avaliar comparativamente os modelos de mensageria Point-to-Point (P2P) e Publish/Subscribe (Pub/Sub) em arquiteturas de microsserviços utilizando Node.js e Redis.

## Objetivo do Projeto

O objetivo deste projeto é implementar dois modelos de comunicação assíncrona entre serviços, avaliando seu comportamento em diferentes cenários experimentais por meio de métricas como latência, throughput, uso de recursos computacionais e aspectos relacionados à confiabilidade da entrega de mensagens.

## Modelos Avaliados

### Point-to-Point

O modelo Point-to-Point é representado por uma fila de mensagens, na qual cada mensagem produzida é consumida por apenas um consumidor. Esse modelo é utilizado para simular cenários de distribuição de tarefas entre workers.

### Publish/Subscribe

O modelo Publish/Subscribe é representado por canais de eventos, nos quais uma mensagem publicada pode ser recebida por múltiplos assinantes. Esse modelo é utilizado para simular cenários de comunicação orientada a eventos entre serviços.

## Tecnologias Utilizadas

- Node.js
- Redis
- Docker
- Docker Compose
- Prometheus
- Grafana

## Estrutura do Projeto

```text
src/
├── common/
├── p2p/
└── pubsub/

experiments/
├── scenarios/
├── scripts/
└── results/

monitoring/
├── prometheus/
└── grafana/

docs/
