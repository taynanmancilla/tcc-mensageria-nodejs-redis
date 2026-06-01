# Módulo Pub/Sub — Publish/Subscribe com Redis Pub/Sub

> Implementação em desenvolvimento.

## Descrição

Este módulo implementa o modelo de mensageria **Publish/Subscribe (Pub/Sub)** utilizando o mecanismo nativo do Redis.

No modelo Pub/Sub, uma mensagem publicada em um canal pode ser recebida por **múltiplos subscribers** simultaneamente. É adequado para disseminação de eventos entre serviços.

## Estrutura

```
src/pubsub/
├── publisher/    # Publisher de mensagens (a implementar)
├── subscriber/   # Subscriber de mensagens (a implementar)
└── README.md
```

## Características do Modelo

- **Fan-out:** uma mensagem é entregue a todos os subscribers ativos no canal.
- **Sem persistência:** mensagens publicadas sem subscribers ativas são descartadas.
- **Baixa latência:** entrega em tempo real sem overhead de persistência.
- **Sem garantia de entrega:** subscribers desconectados no momento da publicação não recebem a mensagem.

## Status

A implementação do publisher e subscriber ainda não foi iniciada. Consulte [`docs/cenarios-experimentais.md`](../../docs/cenarios-experimentais.md) para entender os cenários que serão avaliados.
