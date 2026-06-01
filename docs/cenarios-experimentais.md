# Cenários Experimentais

> Documento em elaboração — descreve os cenários planejados para o experimento.

## Visão Geral

Os experimentos são organizados em cinco cenários (C1–C5), cada um com um objetivo específico e configurações distintas de carga e comportamento dos consumidores.

---

## C1 — Baseline

**Objetivo:** Estabelecer uma linha de base de desempenho para ambos os modelos.

**Descrição:** Taxa de mensagens baixa e constante, um produtor e um consumidor, sem falhas simuladas. Serve como referência para comparação com os demais cenários.

**Configuração:** A definir em `experiments/scenarios/c1-baseline.json`.

---

## C2 — Fila de Tarefas

**Objetivo:** Avaliar a distribuição de tarefas entre múltiplos consumidores no modelo P2P.

**Descrição:** Um produtor envia mensagens representando tarefas. Múltiplos consumidores competem pelo processamento. Mede o balanceamento de carga e a garantia de entrega única.

**Configuração:** A definir em `experiments/scenarios/c2-fila-tarefas.json`.

---

## C3 — Disseminação de Eventos

**Objetivo:** Avaliar a entrega de mensagens para múltiplos assinantes no modelo Pub/Sub.

**Descrição:** Um publisher emite eventos. Múltiplos subscribers recebem a mesma mensagem simultaneamente. Mede latência de fan-out e comportamento sob múltiplos assinantes.

**Configuração:** A definir em `experiments/scenarios/c3-disseminacao-eventos.json`.

---

## C4 — Alta Carga

**Objetivo:** Avaliar o comportamento dos dois modelos sob alta taxa de mensagens por segundo.

**Descrição:** Taxa de injeção elevada, mantida por um período prolongado. Observa-se degradação de latência, throughput máximo e comportamento do Redis sob pressão.

**Configuração:** A definir em `experiments/scenarios/c4-alta-carga.json`.

---

## C5 — Falha de Consumidor

**Objetivo:** Avaliar a resiliência dos modelos diante da queda de um consumidor.

**Descrição:** Durante o experimento, um dos consumidores é interrompido abruptamente. No modelo P2P, avalia-se a reentrega via Redis Streams. No modelo Pub/Sub, avalia-se a perda de mensagens não persistidas.

**Configuração:** A definir em `experiments/scenarios/c5-falha-consumidor.json`.

---

## Próximos Passos

- Definir os parâmetros numéricos de cada cenário (taxa, duração, número de consumidores).
- Implementar o `load-runner` para executar os cenários de forma automatizada.
- Coletar e comparar os resultados em `experiments/results/`.
