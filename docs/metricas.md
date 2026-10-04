# Métricas do Experimento

Este documento descreve a taxonomia conceitual das métricas de comparação entre P2P e Pub/Sub e mapeia cada categoria para a métrica Prometheus real implementada em [`src/common/metrics.js`](../src/common/metrics.js). Valores numéricos observados em cada cenário (ex.: `lost=960` no C5) vivem no [`README.md`](../README.md) principal e nos registros locais de `docs/implementation-log/` — este documento não os reproduz.

## Status

A instrumentação está **implementada** desde a Semana 13 (C1) e vem sendo exercitada em todos os cenários desde então. `src/common/metrics.js` define seis métricas customizadas; cinco delas (`tcc_message_latency_seconds`, `tcc_messages_sent_total`, `tcc_messages_received_total`, `tcc_messages_redelivered_total`, `tcc_messages_lost_total`) foram todas incrementadas em pelo menos um cenário validado até o C5. A sexta, `tcc_queue_depth`, está definida mas **não foi exercitada** em nenhum cenário até agora (ver tabela abaixo).

## Categorias conceituais → métricas reais

| Categoria conceitual | Métrica Prometheus | Tipo | Uso no TCC |
|---|---|---|---|
| Latência | `tcc_message_latency_seconds` | Histogram | Observada em toda mensagem recebida (P2P e Pub/Sub, incluindo mensagens reentregues no P2P). Buckets expostos permitem calcular p50/p95/p99 via `histogram_quantile()` — ver seção abaixo. Usada em todos os cenários C1–C5. |
| Throughput (enviado) | `tcc_messages_sent_total` | Counter | Total de mensagens enviadas por modelo/cenário. Usada em todos os cenários; em C5 também é lida ao vivo (via registry do prom-client) para calcular a janela de perda do Pub/Sub. |
| Throughput (recebido) | `tcc_messages_received_total` | Counter | Total de mensagens recebidas por modelo/cenário, incluindo mensagens reentregues no P2P. Usada em todos os cenários. |
| Confiabilidade — reentrega (P2P) | `tcc_messages_redelivered_total` | Counter | Incrementada por mensagem reclamada via `XAUTOCLAIM` após falha simulada de um worker. Só exercitada no C5 (P2P). |
| Confiabilidade — perda (Pub/Sub) | `tcc_messages_lost_total` | Counter | Incrementada uma vez por execução, pelo valor medido como diferença entre o contador de enviadas no momento da desconexão e da reconexão do subscriber. Só exercitada no C5 (Pub/Sub). |
| Profundidade de fila | `tcc_queue_depth` | Gauge | Implementada (`src/common/metrics.js`), mas **não exercitada em nenhum cenário até C5** — nenhum `.set()` foi chamado em código algum. Candidata a uso futuro (ex.: acompanhar backlog do stream durante C4/C5), mas não faz parte dos resultados atuais. |
| Métricas padrão do processo Node.js | `collectDefaultMetrics` (prom-client) | Vários | Coletadas automaticamente (heap, GC, event loop, etc.) em todos os cenários, mas não usadas na análise comparativa até o momento. |

Todos os labels usados são `model` (`p2p`/`pubsub`) e `scenario` (ex.: `c5-falha-consumidor`) — nenhuma métrica recebeu labels adicionais como `worker`/`subscriber`/`producer`/`publisher`; a distribuição por unidade paralela é informação operacional exibida apenas no terminal de cada cenário (ver `README.md`).

## Como os percentis são calculados

`tcc_message_latency_seconds` é um Histogram, que expõe `_bucket`, `_count` e `_sum` — os percentis (p50/p95/p99) **não são armazenados diretamente**, são calculados pelo Prometheus em tempo de consulta via `histogram_quantile()` sobre os buckets, por exemplo:

```promql
histogram_quantile(0.95, rate(tcc_message_latency_seconds_bucket{model="p2p", scenario="c4-alta-carga"}[2m]))
```

Consultar esse tipo de query **durante** a execução do cenário (ou com uma janela maior que o tempo decorrido desde o fim da execução) é necessário para evitar `NaN` — esse comportamento do `rate()` sobre contadores já estáveis está documentado em detalhe nas seções de validação de C2–C5 no `README.md`.

## Métricas fora do escopo final

As métricas abaixo apareciam no planejamento inicial deste documento, mas **não serão implementadas** neste TCC (decisão de escopo, não pendência):

- **CPU/memória** (uso de recursos por processo Node.js/Redis) — não há instrumentação de recursos do sistema operacional no projeto; `collectDefaultMetrics` expõe métricas do processo Node.js, mas não são usadas comparativamente.
- **Duplicação** (percentual de mensagens entregues mais de uma vez ao mesmo consumidor) — não existe nenhum contador dedicado a isso; o projeto trata duplicação implicitamente através da garantia de entrega única do consumer group (P2P) e nunca mediu isso como taxa.

Caso uma dessas métricas venha a ser implementada futuramente, esta seção deve ser atualizada para refletir o código real, assim como o restante deste documento.

## Ferramentas

- **`prom-client`** — biblioteca Node.js de instrumentação, usada em [`src/common/metrics.js`](../src/common/metrics.js).
- **Prometheus** — coleta e armazenamento de séries temporais (ver [`monitoring/prometheus/README.md`](../monitoring/prometheus/README.md)).
- **Grafana** — dashboards interativos para análise comparativa — configuração ainda pendente (ver `README.md`, seção "Próximos Passos").
