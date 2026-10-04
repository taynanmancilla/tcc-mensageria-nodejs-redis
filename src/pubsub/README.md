# Módulo Pub/Sub — Publish/Subscribe com Redis Pub/Sub

## Descrição

Este módulo implementa o modelo de mensageria **Publish/Subscribe (Pub/Sub)** utilizando o mecanismo nativo do Redis.

No modelo Pub/Sub, uma mensagem publicada em um canal pode ser recebida por **múltiplos subscribers** simultaneamente. É adequado para disseminação de eventos entre serviços.

## Estrutura

```
src/pubsub/
├── publisher.js    # Publica mensagens no canal via PUBLISH
├── subscriber.js   # Assina o canal e observa as entregas via callback
└── README.md
```

- **`publisher.js`** — publica mensagens no canal Redis Pub/Sub (`PUBLISH`), com taxa e tamanho de payload configuráveis via `src/load-runner/rate.js`.
- **`subscriber.js`** — assina o canal (`SUBSCRIBE`) e observa cada mensagem recebida via callback, registrando latência e contagem.

As subpastas `publisher/` e `subscriber/` que aparecem no histórico do projeto são resíduo do scaffolding inicial (apenas `.gitkeep`) — a implementação real são os dois arquivos acima; a orquestração de múltiplos publishers/subscribers e de falhas simuladas vive em `src/load-runner/scenario-runner.js`.

## Características do Modelo

- **Fan-out:** uma mensagem é entregue a todos os subscribers ativos no canal — exercitado no cenário **C3** (múltiplos subscribers simultâneos).
- **Sem persistência:** mensagens publicadas sem subscriber ativo são descartadas — exercitado no cenário **C5**, que mede exatamente essa perda durante a desconexão temporária de um subscriber.
- **Baixa latência:** entrega em tempo real sem overhead de persistência.
- **Sem garantia de entrega:** subscribers desconectados no momento da publicação não recebem a mensagem, e não há reentrega possível (diferente do P2P/Streams).

## Validação

Este módulo é exercitado pelos cenários **C1**, **C3**, **C4** e **C5**. Para comandos de execução e resultados validados, consulte o [`README.md`](../../README.md) principal, seções "Validação — C*".
