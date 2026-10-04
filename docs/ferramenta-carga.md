# Ferramenta de Carga

Este documento descreve a abordagem adotada para injeção de carga no experimento e a justificativa metodológica dessa escolha.

## Abordagem Escolhida

A injeção de carga é realizada por um **script customizado escrito em Node.js**, implementado em `src/load-runner/`.

## Justificativa

A opção por um script próprio em vez de ferramentas genéricas de benchmark (como k6, Artillery ou wrk) se deve aos seguintes motivos:

1. **Integração direta com o Redis:** o load-runner se comunica diretamente com o Redis via SDK Node.js (`redis`), sem necessidade de camada HTTP intermediária, o que reduz variáveis externas e aumenta a precisão das medições.

2. **Controle total sobre o protocolo:** permite simular exatamente os padrões de uso de cada modelo (Redis Streams para P2P, canais Pub/Sub para Pub/Sub) sem adaptar uma ferramenta genérica a protocolos específicos.

3. **Coleta de métricas embutida:** o script registra timestamps de envio e recebimento, calcula latência ponto a ponto e exporta métricas diretamente para o Prometheus via `prom-client`.

4. **Reprodutibilidade:** os cenários são parametrizados por arquivos JSON em `experiments/scenarios/`, garantindo que os experimentos possam ser reproduzidos de forma idêntica.

5. **Coerência tecnológica:** como o restante do projeto utiliza Node.js, manter a ferramenta de carga na mesma plataforma elimina discrepâncias causadas por diferenças de runtime.

## Estrutura

```
src/load-runner/
├── run.js               # Entrada CLI — node src/load-runner/run.js <scenario-id>
├── scenario-runner.js   # Orquestração de P2P/Pub/Sub, múltiplos producers/workers/subscribers e falhas simuladas
├── rate.js              # Utilitários de controle de taxa/carga (rateTicker, buildPadding)
└── README.md
```

Detalhamento de cada arquivo em [`src/load-runner/README.md`](../src/load-runner/README.md).

## Parâmetros Configuráveis

Os cenários em `experiments/scenarios/*.json` utilizam, conforme o caso:

| Parâmetro | Descrição |
|---|---|
| `model` | Modelo a ser testado (`p2p`, `pubsub` ou `both`) |
| `rate` | Taxa agregada de mensagens por segundo |
| `duration` | Duração total do experimento (em segundos) |
| `messageSize` | Tamanho da carga útil da mensagem (em bytes) |
| `producers` | Número de producers/publishers concorrentes (divide `rate` e o volume total entre eles — introduzido no C4) |
| `consumers` | Número de workers P2P concorrentes (competem pelo mesmo stream — introduzido no C2) |
| `subscribers` | Número de subscribers Pub/Sub simultâneos (fan-out — introduzido no C3; quando ausente, assume-se 1) |
| `simulateFailure` | Ativa a simulação de falha de um consumidor/subscriber (introduzido no C5) |
| `failureAt` | Instante, em segundos, em que a falha é simulada |
| `failureDuration` | Duração da janela de falha, em segundos |

## Resultados

Atualmente, o load-runner **não grava arquivos em `experiments/results/`**. Os resultados de cada execução são impressos no terminal (resumo por modelo, distribuição por producer/worker/subscriber, métricas de falha quando aplicável) e expostos em tempo real via `/metrics` (porta `3001`) para coleta pelo Prometheus.

Para os comandos de execução de cada cenário e os resultados validados, consulte o [`README.md`](../README.md) principal.
