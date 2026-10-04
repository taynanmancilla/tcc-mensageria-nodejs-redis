# Módulo Load Runner — Ferramenta de Injeção de Carga

## Descrição

O `load-runner` é o componente que injeta carga controlada no sistema durante os experimentos (C1–C5), lendo a configuração de cada cenário a partir de `experiments/scenarios/*.json` e orquestrando producers/publishers e consumers/subscribers conforme o modelo (`p2p`, `pubsub` ou `both`).

Consulte [`docs/ferramenta-carga.md`](../../docs/ferramenta-carga.md) para a justificativa da escolha de um script customizado em vez de uma ferramenta genérica de benchmark.

## Estrutura

```
src/load-runner/
├── run.js              # Entrada CLI — node src/load-runner/run.js <scenario-id>
├── scenario-runner.js   # Orquestração dos cenários
├── rate.js              # Utilitários de controle de taxa/carga (rateTicker, buildPadding)
└── README.md
```

- **`run.js`** — ponto de entrada via linha de comando. Recebe o id do cenário como argumento (ex.: `c5-falha-consumidor`), chama `runScenario()` e trata o encerramento via `SIGINT`.
- **`scenario-runner.js`** — orquestra a execução de P2P e/ou Pub/Sub conforme o `model` do cenário. Suporta múltiplos producers/publishers e múltiplos workers/subscribers (introduzidos em C2–C4), e a simulação de falha de consumidor do C5 (worker derrubado com recuperação via `XAUTOCLAIM` no P2P; subscriber desconectado com perda medida via counters no Pub/Sub).
- **`rate.js`** — utilitários reaproveitados por producer/publisher: `rateTicker()` controla a taxa de emissão (msg/s) e `buildPadding()` ajusta o payload ao `messageSize` configurado.

As subpastas `runners/` e `scenarios/` que aparecem no histórico do projeto são resíduo do scaffolding inicial (apenas `.gitkeep`) — não contêm implementação; o código real está nos três arquivos acima.

## Como os resultados são expostos

O load-runner **não grava arquivos de resultado** em `experiments/results/` — essa pasta permanece vazia. Os resultados de cada execução são:
- impressos no terminal (resumo por modelo, distribuição por worker/subscriber/producer, métricas de falha quando aplicável);
- expostos em tempo real via `/metrics` (porta `3001`) para coleta pelo Prometheus.

Para os comandos de execução de cada cenário (`npm run scenario:c1` a `c5`) e os resultados validados, consulte o [`README.md`](../../README.md) principal.
