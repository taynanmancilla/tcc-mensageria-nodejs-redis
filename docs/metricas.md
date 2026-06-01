# Métricas do Experimento

> Documento em elaboração — lista as métricas que serão coletadas e comparadas.

## Métricas de Latência

| Métrica             | Descrição                                                                 |
|---------------------|---------------------------------------------------------------------------|
| Latência média      | Tempo médio entre o envio de uma mensagem e o recebimento pelo consumidor |
| P95                 | 95% das mensagens foram entregues dentro deste tempo                      |
| P99                 | 99% das mensagens foram entregues dentro deste tempo                      |

## Métricas de Throughput

| Métrica             | Descrição                                                                 |
|---------------------|---------------------------------------------------------------------------|
| Throughput          | Número de mensagens processadas por segundo (msgs/s)                      |
| Tempo em fila       | Tempo médio que uma mensagem permanece aguardando processamento            |

## Métricas de Recursos Computacionais

| Métrica             | Descrição                                                                 |
|---------------------|---------------------------------------------------------------------------|
| CPU                 | Percentual de uso de CPU pelos processos Node.js e pelo Redis             |
| Memória             | Consumo de memória RAM pelos processos Node.js e pelo Redis               |

## Métricas de Confiabilidade

| Métrica             | Descrição                                                                 |
|---------------------|---------------------------------------------------------------------------|
| Perda de mensagens  | Percentual de mensagens enviadas que não foram recebidas                  |
| Duplicação          | Percentual de mensagens entregues mais de uma vez ao mesmo consumidor     |
| Reentrega           | Número de mensagens reentregues após falha ou timeout (P2P / Streams)     |

## Coleta

As métricas serão expostas no formato Prometheus via `prom-client` e coletadas pelo servidor Prometheus em intervalos configuráveis. A visualização será feita no Grafana.

## Ferramentas

- **`prom-client`** — biblioteca Node.js para instrumentação e exposição de métricas.
- **Prometheus** — coleta e armazenamento de séries temporais.
- **Grafana** — dashboards interativos para análise comparativa.

## Status

A instrumentação dos componentes ainda não foi implementada. Este documento descreve as métricas planejadas para o experimento.
