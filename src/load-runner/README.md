# Módulo Load Runner — Ferramenta de Injeção de Carga

> Implementação em desenvolvimento.

## Descrição

O `load-runner` é o componente responsável por injetar carga controlada no sistema durante os experimentos. É implementado inteiramente em Node.js e se integra diretamente com o Redis.

Consulte [`docs/ferramenta-carga.md`](../../docs/ferramenta-carga.md) para a justificativa detalhada da escolha dessa abordagem.

## Estrutura

```
src/load-runner/
├── runners/     # Implementação dos runners P2P e Pub/Sub (a implementar)
├── scenarios/   # Referência/carregamento dos cenários JSON (a implementar)
└── README.md
```

## Funcionamento Previsto

1. O runner carrega um arquivo de configuração de cenário (`experiments/scenarios/*.json`).
2. Inicializa a conexão com o Redis conforme o modelo configurado.
3. Injeta mensagens na taxa especificada durante o tempo definido.
4. Registra métricas de envio via `prom-client`.
5. Ao final, grava um resumo em `experiments/results/`.

## Status

A implementação ainda não foi iniciada. Consulte [`docs/cenarios-experimentais.md`](../../docs/cenarios-experimentais.md) para entender os cenários que serão executados.
