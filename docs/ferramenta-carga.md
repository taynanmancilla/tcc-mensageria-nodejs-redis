# Ferramenta de Carga

> Documento em elaboração — descreve a abordagem adotada para injeção de carga no experimento.

## Abordagem Escolhida

A injeção de carga será realizada por um **script customizado escrito em Node.js**, localizado em `src/load-runner/`.

## Justificativa

A opção por um script próprio em vez de ferramentas genéricas de benchmark (como k6, Artillery ou wrk) se deve aos seguintes motivos:

1. **Integração direta com o Redis:** O load-runner se comunica diretamente com o Redis via SDK Node.js (`ioredis` ou `redis`), sem necessidade de camada HTTP intermediária, o que reduz variáveis externas e aumenta a precisão das medições.

2. **Controle total sobre o protocolo:** Permite simular exatamente os padrões de uso de cada modelo (Redis Streams para P2P, canais Pub/Sub para Pub/Sub) sem adaptar uma ferramenta genérica a protocolos específicos.

3. **Coleta de métricas embutida:** O script pode registrar timestamps de envio e recebimento, calcular latência ponto a ponto e exportar métricas diretamente para o Prometheus via `prom-client`.

4. **Reprodutibilidade:** Os cenários são parametrizados por arquivos JSON em `experiments/scenarios/`, garantindo que os experimentos possam ser reproduzidos de forma idêntica.

5. **Coerência tecnológica:** Como o restante do projeto utiliza Node.js, manter a ferramenta de carga na mesma plataforma elimina discrepâncias causadas por diferenças de runtime.

## Estrutura

```
src/load-runner/
├── runners/      # Implementação dos runners para cada modelo (a implementar)
├── scenarios/    # Referência aos arquivos de configuração de cenários
└── README.md
```

## Parâmetros Configuráveis (previstos)

| Parâmetro            | Descrição                                          |
|----------------------|----------------------------------------------------|
| `rate`               | Taxa de mensagens por segundo                      |
| `duration`           | Duração total do experimento (em segundos)         |
| `model`              | Modelo a ser testado (`p2p` ou `pubsub`)           |
| `consumers`          | Número de consumidores/subscribers simultâneos     |
| `messageSize`        | Tamanho da carga útil da mensagem (em bytes)       |
| `scenario`           | Identificador do cenário (C1–C5)                   |

## Status

A implementação do load-runner ainda não foi iniciada. Este documento descreve a abordagem planejada.
