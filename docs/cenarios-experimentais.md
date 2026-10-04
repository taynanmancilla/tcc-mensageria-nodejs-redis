# Cenários Experimentais

Este documento descreve a **justificativa do desenho experimental**: por que o experimento é organizado em cinco cenários (C1–C5), qual variável cada um isola e qual pergunta metodológica cada um responde. Parâmetros numéricos exatos (rate, duration, mensagens por produtor/consumidor etc.) vivem em `experiments/scenarios/*.json` — a fonte de verdade executável — e os resultados validados de cada execução estão documentados no [`README.md`](../README.md) principal, seção "Validação — C*". Este documento não duplica nem um nem outro: ele explica o raciocínio por trás da progressão dos cenários.

---

## Visão Geral

Os cinco cenários formam uma progressão deliberada, cada um introduzindo exatamente uma variável nova em relação ao anterior, para que qualquer diferença observada entre P2P e Pub/Sub possa ser atribuída a essa variável isolada, não a uma mudança de múltiplos fatores ao mesmo tempo:

| Cenário | Variável isolada | Build sobre |
|---|---|---|
| C1 | Nenhuma (linha de base) | — |
| C2 | Paralelismo no lado consumidor (P2P) | C1 |
| C3 | Fan-out no lado subscriber (Pub/Sub) | C1 |
| C4 | Alta taxa + paralelismo no lado emissor (ambos) | C1–C3 |
| C5 | Falha/resiliência de um consumidor (ambos) | C1–C4 |

---

## C1 — Baseline

**Objetivo metodológico:** estabelecer uma linha de base de desempenho para ambos os modelos, sem nenhuma forma de paralelismo ou falha, servindo de referência de comparação para todos os cenários seguintes.

**Variável isolada:** nenhuma — rate baixo e constante, 1 producer/publisher, 1 consumer/subscriber.

**Modelo(s) avaliado(s):** P2P e Pub/Sub, executados em sequência (isolamento de modelos).

**Configuração:** ver [`experiments/scenarios/c1-baseline.json`](../experiments/scenarios/c1-baseline.json).

**Resultados validados:** ver seção "Validação — C1 Baseline" no [`README.md`](../README.md).

---

## C2 — Fila de Tarefas

**Objetivo metodológico:** avaliar a distribuição de tarefas entre múltiplos consumidores no modelo P2P, medindo balanceamento de carga e garantia de entrega única (nenhuma mensagem processada duas vezes, nenhuma perdida).

**Variável isolada:** múltiplos workers (consumer group) competindo pelo mesmo stream — múltiplos workers P2P.

**Modelo(s) avaliado(s):** apenas P2P.

**Configuração:** ver [`experiments/scenarios/c2-fila-tarefas.json`](../experiments/scenarios/c2-fila-tarefas.json).

**Resultados validados:** ver seção "Validação — C2 Fila de Tarefas" no [`README.md`](../README.md).

---

## C3 — Disseminação de Eventos

**Objetivo metodológico:** avaliar a entrega de mensagens para múltiplos assinantes no modelo Pub/Sub — fan-out Pub/Sub —, medindo fidelidade de entrega (cada subscriber deve receber a cópia completa do que foi publicado).

**Variável isolada:** múltiplos subscribers independentes recebendo o mesmo fluxo (fan-out), em oposição à competição por mensagens do C2.

**Modelo(s) avaliado(s):** apenas Pub/Sub.

**Configuração:** ver [`experiments/scenarios/c3-disseminacao-eventos.json`](../experiments/scenarios/c3-disseminacao-eventos.json).

**Resultados validados:** ver seção "Validação — C3 Disseminação de Eventos" no [`README.md`](../README.md).

---

## C4 — Alta Carga

**Objetivo metodológico:** avaliar o comportamento dos dois modelos sob alta taxa de mensagens por segundo e múltiplas unidades emissoras simultâneas, observando degradação de latência e estabilidade em volume significativamente maior que C1–C3.

**Variável isolada:** taxa agregada alta e paralelismo no lado emissor (múltiplos producers/publishers), mantendo o paralelismo do lado consumidor já validado em C2/C3 — a primeira combinação de paralelismo nos dois lados do fluxo ao mesmo tempo.

**Modelo(s) avaliado(s):** P2P e Pub/Sub.

**Configuração:** ver [`experiments/scenarios/c4-alta-carga.json`](../experiments/scenarios/c4-alta-carga.json).

**Resultados validados:** ver seção "Validação — C4 Alta Carga" no [`README.md`](../README.md).

---

## C5 — Falha de Consumidor

**Objetivo metodológico:** avaliar a resiliência e confiabilidade dos dois modelos diante da queda temporária de um consumidor/subscriber — o cenário central para a comparação de garantias de entrega entre os dois modelos.

**Variável isolada:** falha simulada e temporária de uma unidade receptora, isolada de fan-out (já coberto em C3) e de alta carga (já coberta em C4) para que o efeito da falha possa ser atribuído só a ela. No P2P, avalia-se a reentrega via PEL/`XCLAIM`/`XAUTOCLAIM` do Redis Streams; no Pub/Sub, avalia-se a perda real de mensagens publicadas enquanto o subscriber está desconectado, já que não há persistência.

**Modelo(s) avaliado(s):** P2P e Pub/Sub.

**Configuração:** ver [`experiments/scenarios/c5-falha-consumidor.json`](../experiments/scenarios/c5-falha-consumidor.json).

**Resultados validados:** ver seção "Validação — C5 Falha de Consumidor" no [`README.md`](../README.md).

---

## Próximos Passos

Com os cinco cenários implementados e validados, o trabalho de desenho experimental está concluído. Os próximos passos são:

- Consolidar os resultados de C1–C5 em tabelas e gráficos comparativos (throughput, latência p50/p95/p99, confiabilidade).
- Redigir a análise comparativa P2P vs. Pub/Sub para a monografia, usando os dados já validados em cada seção do `README.md` e nos registros locais de `docs/implementation-log/`.
