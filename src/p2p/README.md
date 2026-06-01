# Módulo P2P — Point-to-Point com Redis Streams

> Implementação em desenvolvimento.

## Descrição

Este módulo implementa o modelo de mensageria **Point-to-Point (P2P)** utilizando **Redis Streams**.

No modelo P2P, cada mensagem produzida é consumida por **apenas um consumidor**. O Redis Streams oferece persistência, grupos de consumidores e suporte a reentrega em caso de falha.

## Estrutura

```
src/p2p/
├── producer/   # Produtor de mensagens (a implementar)
├── consumer/   # Consumidor de mensagens (a implementar)
└── README.md
```

## Características do Modelo

- **Persistência:** mensagens ficam armazenadas no stream até serem reconhecidas (`XACK`).
- **Grupos de consumidores:** múltiplos consumidores podem competir pelo processamento, com garantia de entrega única por grupo.
- **Reentrega:** mensagens não reconhecidas dentro de um timeout são reentregues automaticamente.
- **Ordering:** mensagens são entregues na ordem de inserção.

## Status

A implementação do produtor e consumidor ainda não foi iniciada. Consulte [`docs/cenarios-experimentais.md`](../../docs/cenarios-experimentais.md) para entender os cenários que serão avaliados.
