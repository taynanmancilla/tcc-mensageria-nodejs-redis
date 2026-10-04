# Módulo P2P — Point-to-Point com Redis Streams

## Descrição

Este módulo implementa o modelo de mensageria **Point-to-Point (P2P)** utilizando **Redis Streams**.

No modelo P2P, cada mensagem produzida é consumida por **apenas um consumidor**. O Redis Streams oferece persistência, grupos de consumidores e suporte a reentrega em caso de falha.

## Estrutura

```
src/p2p/
├── producer.js   # Produz mensagens no stream via XADD
├── consumer.js   # Cria o consumer group e consome via XREADGROUP/XACK
└── README.md
```

- **`producer.js`** — publica mensagens no Redis Stream (`XADD`), com taxa e tamanho de payload configuráveis via `src/load-runner/rate.js`.
- **`consumer.js`** — cria o consumer group (`setupGroup`) e consome mensagens via `XREADGROUP`, confirmando cada uma com `XACK`.

As subpastas `producer/` e `consumer/` que aparecem no histórico do projeto são resíduo do scaffolding inicial (apenas `.gitkeep`) — a implementação real são os dois arquivos acima; a orquestração de múltiplos workers e de falhas simuladas vive em `src/load-runner/scenario-runner.js`.

## Características do Modelo

- **Persistência:** mensagens ficam armazenadas no stream até serem reconhecidas (`XACK`).
- **Grupos de consumidores:** múltiplos consumidores podem competir pelo processamento, com garantia de entrega única por grupo — exercitado no cenário **C2** (múltiplos workers).
- **Reentrega:** mensagens lidas mas não confirmadas ficam pendentes no PEL (Pending Entries List) e podem ser recuperadas via `XCLAIM`/`XAUTOCLAIM` — exercitado no cenário **C5** (falha simulada de um worker com recuperação).
- **Ordering:** mensagens são entregues na ordem de inserção.

## Validação

Este módulo é exercitado pelos cenários **C1**, **C2**, **C4** e **C5**. Para comandos de execução e resultados validados, consulte o [`README.md`](../../README.md) principal, seções "Validação — C*".
