# Avaliação Comparativa de Modelos de Mensageria P2P e Pub/Sub com Node.js e Redis

Projeto experimental desenvolvido como Trabalho de Conclusão de Curso (TCC) em Engenharia de Computação. O objetivo é avaliar comparativamente os modelos de mensageria **Point-to-Point (P2P)** e **Publish/Subscribe (Pub/Sub)** em arquiteturas de microsserviços utilizando Node.js e Redis.

---

## Objetivo

Implementar dois modelos de comunicação assíncrona entre serviços e avaliar seu comportamento em diferentes cenários experimentais por meio de métricas quantitativas de desempenho, uso de recursos e confiabilidade na entrega de mensagens.

---

## Modelos Avaliados

### Point-to-Point (P2P) — Redis Streams

Cada mensagem produzida é consumida por **apenas um consumidor**. Utiliza Redis Streams com grupos de consumidores, garantindo persistência e suporte a reentrega em caso de falha.

### Publish/Subscribe (Pub/Sub) — Redis Pub/Sub

Uma mensagem publicada é entregue a **todos os subscribers** ativos no canal simultaneamente. Utiliza o mecanismo nativo de Pub/Sub do Redis, sem persistência.

---

## Tecnologias

| Tecnologia     | Função                                               |
|----------------|------------------------------------------------------|
| Node.js        | Runtime principal para produtores, consumidores e load-runner |
| Redis          | Camada de mensageria (Streams e Pub/Sub)             |
| Docker         | Containerização dos componentes                      |
| Docker Compose | Orquestração local do ambiente                       |
| Prometheus     | Coleta e armazenamento de métricas                   |
| Grafana        | Visualização e análise dos resultados                |
| prom-client    | Instrumentação dos componentes Node.js               |

---

## Estrutura do Projeto

```text
docs/
├── arquitetura.md              # Descrição da arquitetura do experimento
├── cenarios-experimentais.md   # Cenários C1–C5
├── ferramenta-carga.md         # Justificativa e descrição do load-runner
└── metricas.md                 # Métricas coletadas

experiments/
├── scenarios/                  # Configurações JSON dos cenários
├── scripts/                    # Scripts auxiliares de experimento
└── results/                    # Resultados gerados (ignorado pelo git)

monitoring/
├── grafana/                    # Configuração do Grafana
└── prometheus/                 # Configuração do Prometheus

src/
├── common/                     # Código compartilhado (config, Redis, métricas, utils)
├── p2p/                        # Produtor e consumidor P2P (Redis Streams)
├── pubsub/                     # Publisher e subscriber Pub/Sub
└── load-runner/                # Ferramenta de injeção de carga

tests/
└── .gitkeep                    # Testes a serem implementados
```

---

## Ferramenta de Carga

A injeção de carga é realizada por um **script customizado em Node.js** (`src/load-runner/`), que se integra diretamente com o Redis sem camada HTTP intermediária. Isso garante controle preciso sobre o protocolo, coleta de métricas embutida e reprodutibilidade dos experimentos.

Consulte [`docs/ferramenta-carga.md`](docs/ferramenta-carga.md) para a justificativa completa.

---

## Status Atual

> **Fase: C1–C5 implementados e validados (Semana 16) — próxima etapa: consolidação de resultados**

- [x] Estrutura de pastas definida
- [x] Documentação inicial criada
- [x] Dependências declaradas (`package.json`)
- [x] Docker Compose configurado com Redis, Prometheus e Grafana
- [x] `src/common/` — config, conexão Redis e servidor `/metrics` implementados
- [x] `src/p2p/` — producer e consumer P2P (Redis Streams) implementados
- [x] `src/pubsub/` — publisher e subscriber Pub/Sub implementados
- [x] `src/prototypes/basic.js` — protótipo básico executável (Semana 12)
- [x] `src/load-runner/` — load-runner parametrizado implementado (C1 Baseline)
- [x] C2 — Fila de Tarefas: 4 workers P2P, 3000 msgs a 50 msg/s (Semana 13)
- [x] C3 — Disseminação de Eventos: 4 subscribers Pub/Sub, fan-out, 3000 msgs a 50 msg/s (Semana 14)
- [x] C4 — Alta Carga: 2 producers/publishers, 4 consumers P2P, 1000 msg/s agregado, 120000 msgs (Semana 15)
- [x] C5 — Falha de Consumidor: falha simulada P2P (PEL + XAUTOCLAIM) e Pub/Sub (perda medida via counters), 4500 msgs (Semana 16)
- [ ] Configuração de dashboards no Grafana
- [ ] Consolidação de resultados e análise comparativa para o TCC

---

## Instalação

### Pré-requisitos

- Node.js >= 18
- Docker e Docker Compose

### Passos

```bash
# Clone o repositório
git clone <url-do-repositório>
cd tcc-mensageria-nodejs-redis

# Instale as dependências
npm install

# Copie o arquivo de variáveis de ambiente
cp .env.example .env

# Suba os serviços (Redis, Prometheus, Grafana)
npm run docker:up

# Execute o projeto (entrada de validação)
npm start
```

### Validação da infraestrutura

```bash
# Verificar containers em execução
docker ps

# Verificar saúde do Redis
docker exec -it tcc-redis redis-cli ping
# Resposta esperada: PONG
```

| Serviço    | URL                    | Observação                                          |
|------------|------------------------|-----------------------------------------------------|
| Prometheus | http://localhost:9090  | Target `nodejs-app` deve aparecer como **UP**       |
| Grafana    | http://localhost:3000  | Usuário: `admin` / Senha: `admin`                   |
| Redis      | `localhost:6379`       | Verificar com `redis-cli ping`                      |

---

## Validação — Camada `src/common/`

Com Docker e Node.js em execução, siga os passos abaixo para confirmar que a camada comum está funcionando:

```bash
# 1. Suba a infraestrutura (Redis, Prometheus, Grafana)
npm run docker:up

# 2. Copie o .env se ainda não existir
cp .env.example .env

# 3. Inicie a aplicação
npm start
```

**Saída esperada no terminal:**

```
[metrics] server listening on http://localhost:3001/metrics
[redis] connected — localhost:6379
```

**Verificar o endpoint de métricas:**

```bash
curl http://localhost:3001/metrics
```

Deve retornar texto no formato Prometheus com métricas padrão do Node.js (process, heap, GC) e as métricas customizadas do TCC (`tcc_message_latency_seconds`, `tcc_messages_sent_total`, etc.).

**Verificar o status no Prometheus:**

1. Acesse http://localhost:9090/targets
2. O job `nodejs-app` deve aparecer como **UP** (anteriormente ficava DOWN)

**Encerrar:**

```bash
# Ctrl+C encerra a aplicação e desconecta o Redis
npm run docker:down
```

---

## Validação — Protótipo Básico (Semana 12)

Com a infraestrutura Docker em execução (`npm run docker:up`), execute:

```bash
npm run prototype:basic
```

**Saída esperada no terminal:**

```
============================================================
TCC — Protótipo Básico (Semana 12)
P2P vs Pub/Sub — Node.js + Redis
============================================================

[P2P] Iniciando fluxo P2P (Redis Streams)...

[p2p:producer] enviando 20 mensagens → tcc:p2p:stream
[p2p:producer] enviada 1/20
...
[p2p:consumer] recebida 1/20 — latência: X.XXms
...

[Pub/Sub] Iniciando fluxo Pub/Sub (Redis Pub/Sub)...

[pubsub:publisher] publicando 20 mensagens → tcc:pubsub:channel
...
[pubsub:subscriber] recebida 1/20 — latência: X.XXms
...

============================================================
Resumo
============================================================
P2P     | 20 enviadas | 20 recebidas | X.XXs
Pub/Sub | 20 enviadas | 20 recebidas | X.XXs

Métricas:   http://localhost:3001/metrics
Prometheus: http://localhost:9090/graph

Aguardando Ctrl+C para encerrar...
```

**Verificar métricas via curl** (em outro terminal, com o protótipo em execução):

```bash
# Contadores de mensagens
curl -s http://localhost:3001/metrics | grep "^tcc_messages"

# Buckets de latência
curl -s http://localhost:3001/metrics | grep "tcc_message_latency"
```

**Queries PromQL no Prometheus** (http://localhost:9090/graph):

```promql
# Total de mensagens enviadas por modelo
tcc_messages_sent_total

# Total de mensagens recebidas por modelo
tcc_messages_received_total

# Latência mediana (p50) do P2P
histogram_quantile(0.50, rate(tcc_message_latency_seconds_bucket{model="p2p"}[1m]))

# Latência p95 do Pub/Sub
histogram_quantile(0.95, rate(tcc_message_latency_seconds_bucket{model="pubsub"}[1m]))

# Comparação p99 entre os dois modelos
histogram_quantile(0.99, rate(tcc_message_latency_seconds_bucket[1m]))
```

> Os percentis são calculados pelo Prometheus via `histogram_quantile()` sobre os buckets expostos pelo `prom-client`. A aplicação expõe `_bucket`, `_count` e `_sum` — os percentis não são armazenados diretamente.

**Por que `histogram_quantile` retorna `NaN` no protótipo curto?**

`histogram_quantile` depende de `rate()`, que exige ao menos dois pontos de scrape consecutivos com delta positivo. O protótipo envia 20 mensagens em menos de 2 segundos; o Prometheus coleta a cada 5 segundos. Se o scrape acontecer após a execução terminar, `rate(...[1m])` encontra uma série estável (sem incremento no período) e retorna `NaN`. Esse comportamento é correto — não há erro na instrumentação nem nas queries. Para obter percentis válidos, os experimentos precisam ter duração suficiente para que múltiplos scrapes coincidam com mensagens sendo processadas.

**Percentis relevantes nos experimentos parametrizados (Semanas 13/14)**

Os cenários C1–C5 têm duração de 60–120 segundos, o que garante 12–24 scrapes durante a execução — suficiente para que `rate()` produza valores estáveis.

| Percentil | Uso no TCC |
|---|---|
| p50 (mediana) | Linha de base; comportamento típico sob carga normal (C1) |
| p95 | Referência de SLA; captura a degradação antes do colapso (C2, C3) |
| p99 | Latência de cauda; mais sensível a rajadas e contenção (C4 — 1000 msg/s) |

No cenário C4 (alta carga), espera-se que p50 e p99 divirjam significativamente entre P2P e Pub/Sub, fornecendo os dados centrais para a comparação do TCC. No cenário C5 (falha de consumidor), o p99 do modelo P2P deve revelar o custo da reentrega via `XPENDING`.

---

## Validação — C1 Baseline (Semana 13)

> **Pré-requisito:** não execute `npm start` simultaneamente — o cenário C1 sobe seu próprio servidor de métricas na mesma porta 3001.

```bash
# 1. Infraestrutura Docker (se ainda não estiver rodando)
npm run docker:up

# 2. Executar o C1 Baseline
npm run scenario:c1
```

**Saída esperada no terminal:**

```
============================================================
TCC — C1 — Baseline
============================================================
Cenário:     c1-baseline
Rate:        10 msg/s
Duration:    60s
Total msgs:  600 por modelo
MessageSize: ~256 bytes
Modelo:      both
============================================================

[P2P] Iniciando — 600 msgs a 10 msg/s por 60s

[p2p:producer] iniciando — 600 msgs a 10 msg/s
[p2p:producer] 10% (60/600)
...
[p2p:producer] 100% (600/600)
[p2p:consumer] 10% (60/600)
...
[p2p:consumer] 100% (600/600)

[P2P] Concluído — 600 enviadas | 600 recebidas | ~60.XXs

[Pub/Sub] Iniciando — 600 msgs a 10 msg/s por 60s
...
[Pub/Sub] Concluído — 600 enviadas | 600 recebidas | ~60.XXs

============================================================
Resumo
============================================================
P2P     | 600 env | 600 rec | perda: 0.0% | ~60.XXs
Pub/Sub | 600 env | 600 rec | perda: 0.0% | ~60.XXs

Nota: P2P e Pub/Sub executados em sequência (isolamento de modelos).

Métricas:   http://localhost:3001/metrics
Prometheus: http://localhost:9090/graph

Aguardando Ctrl+C para encerrar...
```

**Validar métricas via curl** (em outro terminal, com o cenário em execução ou logo após):

```bash
# Contadores de mensagens enviadas e recebidas
curl -s http://localhost:3001/metrics | grep "^tcc_messages"

# Buckets de latência do C1
curl -s http://localhost:3001/metrics | grep 'tcc_message_latency.*c1-baseline'
```

**Queries PromQL** (http://localhost:9090/graph):

```promql
# Mensagens enviadas por modelo no C1
tcc_messages_sent_total{scenario="c1-baseline"}

# Mensagens recebidas por modelo no C1
tcc_messages_received_total{scenario="c1-baseline"}

# Latência p50 do P2P no C1
histogram_quantile(0.50, rate(tcc_message_latency_seconds_bucket{model="p2p", scenario="c1-baseline"}[2m]))

# Latência p95 do Pub/Sub no C1
histogram_quantile(0.95, rate(tcc_message_latency_seconds_bucket{model="pubsub", scenario="c1-baseline"}[2m]))

# Comparação p99 entre os dois modelos
histogram_quantile(0.99, rate(tcc_message_latency_seconds_bucket{scenario="c1-baseline"}[2m]))
```

> Com duração de 60s e scrape a cada 5s, o Prometheus terá ~12 pontos de coleta por modelo. As queries acima retornarão valores reais (não NaN) durante e após a execução, diferentemente do protótipo da Semana 12.

> P2P e Pub/Sub são executados em **sequência** (isolamento intencional de modelos). Nas queries PromQL, filtre sempre pelo label `model` para comparar janelas de tempo distintas.

---

## Validação — C2 Fila de Tarefas (Semana 13)

> **Pré-requisito:** não execute `npm start` simultaneamente — o cenário C2 sobe seu próprio servidor de métricas na mesma porta 3001.

```bash
# 1. Infraestrutura Docker (se ainda não estiver rodando)
npm run docker:up

# 2. Executar o C2 Fila de Tarefas
npm run scenario:c2
```

**Saída esperada no terminal:**

```
============================================================
TCC — C2 — Fila de Tarefas
============================================================
Cenário:     c2-fila-tarefas
Rate:        50 msg/s
Duration:    60s
Total msgs:  3000 por modelo
MessageSize: ~512 bytes
Modelo:      p2p
Consumers:   4
============================================================

[P2P] Iniciando — 3000 msgs a 50 msg/s por 60s | 4 workers

[p2p:producer] iniciando — 3000 msgs a 50 msg/s
[p2p:worker-2] 10% (300/3000)
[p2p:worker-1] 20% (600/3000)
...
[p2p:worker-4] 100% (3000/3000)

[P2P] Concluído — 3000 enviadas | 3000 recebidas | ~60.XXs

============================================================
Resumo
============================================================
P2P     | 3000 env | 3000 rec | perda: 0.0% | ~60.XXs
         worker-1: ~750 msgs (~25.0%)
         worker-2: ~750 msgs (~25.0%)
         worker-3: ~750 msgs (~25.0%)
         worker-4: ~750 msgs (~25.0%)

Nota: P2P e Pub/Sub executados em sequência (isolamento de modelos).

Métricas:   http://localhost:3001/metrics
Prometheus: http://localhost:9090/graph

Aguardando Ctrl+C para encerrar...
```

> A distribuição entre workers pode variar por corrida. Em Redis Streams com consumer groups, cada mensagem é entregue ao consumer que executa XREADGROUP e está disponível no momento — não há garantia de round-robin estrito pelo protocolo. O ponto central do C2 é confirmar que as 3000 mensagens foram processadas sem perda e sem duplicação, independente de como foram distribuídas entre os workers.

**Validar métricas via curl** (em outro terminal, com o cenário em execução):

```bash
# Total enviadas e recebidas no C2
curl -s http://localhost:3001/metrics | grep 'tcc_messages.*c2-fila-tarefas'
```

**Queries PromQL** (http://localhost:9090/graph):

```promql
# Total enviado pelo produtor no C2
tcc_messages_sent_total{scenario="c2-fila-tarefas"}

# Total recebido pelos 4 workers no C2 (sem label worker — agregado)
tcc_messages_received_total{scenario="c2-fila-tarefas"}

# Latência p50 do P2P no C2
histogram_quantile(0.50, rate(tcc_message_latency_seconds_bucket{model="p2p", scenario="c2-fila-tarefas"}[2m]))

# Latência p95 do P2P no C2
histogram_quantile(0.95, rate(tcc_message_latency_seconds_bucket{model="p2p", scenario="c2-fila-tarefas"}[2m]))

# Comparação de latência p99 entre C1 e C2 (ambos P2P)
histogram_quantile(0.99, rate(tcc_message_latency_seconds_bucket{model="p2p"}[2m]))
```

> As métricas de latência são coletadas por worker na aplicação, mas emitidas sem label de worker — label `scenario="c2-fila-tarefas"` agrega todos os 4 workers. Isso permite comparar C1 vs C2 via `scenario` sem fragmentar o histograma por worker.

---

## Validação — C3 Disseminação de Eventos (Semana 14)

> **Pré-requisito:** não execute `npm start` simultaneamente — o cenário C3 sobe seu próprio servidor de métricas na mesma porta 3001.

```bash
# 1. Infraestrutura Docker (se ainda não estiver rodando)
npm run docker:up

# 2. Executar o C3 Disseminação de Eventos
npm run scenario:c3
```

**Saída esperada no terminal:**

```
============================================================
TCC — C3 — Disseminação de Eventos
============================================================
Cenário:     c3-disseminacao-eventos
Rate:        50 msg/s
Duration:    60s
Total msgs:  3000 por modelo
MessageSize: ~512 bytes
Modelo:      pubsub
Subscribers: 4
============================================================

[Pub/Sub] Iniciando — 3000 msgs a 50 msg/s por 60s | 4 subscribers

[pubsub:publisher] iniciando — 3000 msgs a 50 msg/s
...
[pubsub:publisher] 100% (3000/3000)

[Pub/Sub] Concluído — 3000 enviadas | 12000 recebidas (agregado) | ~60.XXs

============================================================
Resumo
============================================================
Pub/Sub | 3000 env | 12000 rec (agregado, 4 subscribers × 3000 esperado) | ~60.XXs
         subscriber-1: 3000/3000 msgs (100.0%)
         subscriber-2: 3000/3000 msgs (100.0%)
         subscriber-3: 3000/3000 msgs (100.0%)
         subscriber-4: 3000/3000 msgs (100.0%)

Métricas:   http://localhost:3001/metrics
Prometheus: http://localhost:9090/graph

Aguardando Ctrl+C para encerrar...
```

> **Por que `received_total` chega a 12000 enquanto `sent_total` é 3000?** No modelo Pub/Sub, cada mensagem publicada é entregue a **todos** os subscribers ativos (fan-out), diferente do P2P, onde as mensagens são distribuídas entre consumidores concorrentes (soma = total enviado). Em C3, com 4 subscribers, cada um recebe a cópia completa das 3000 mensagens, totalizando `3000 × 4 = 12000` entregas. **`received > sent` é o comportamento esperado e correto neste cenário**, não uma perda negativa nem uma duplicação indevida. Por isso, a métrica de "perda" só faz sentido calculada por subscriber (`recebido / 3000`), nunca como `(sent - received_agregado) / sent`.

**Validar métricas via curl** (em outro terminal, com o cenário em execução):

```bash
# Total publicado e total recebido (agregado, 4 subscribers) no C3
curl -s http://localhost:3001/metrics | grep 'tcc_messages.*c3-disseminacao-eventos'

# Confirmar 12000 observações de latência (uma por entrega, não por publicação)
curl -s http://localhost:3001/metrics | grep 'tcc_message_latency_seconds_count.*c3-disseminacao-eventos'
```

**Queries PromQL** (http://localhost:9090/graph):

```promql
# Total enviado pelo publisher no C3 (esperado: 3000)
tcc_messages_sent_total{scenario="c3-disseminacao-eventos"}

# Total recebido agregado no C3 (esperado: 12000 = 3000 × 4 subscribers)
tcc_messages_received_total{scenario="c3-disseminacao-eventos"}

# Latência p50 do Pub/Sub no C3
histogram_quantile(0.50, rate(tcc_message_latency_seconds_bucket{model="pubsub", scenario="c3-disseminacao-eventos"}[2m]))

# Latência p95 do Pub/Sub no C3
histogram_quantile(0.95, rate(tcc_message_latency_seconds_bucket{model="pubsub", scenario="c3-disseminacao-eventos"}[2m]))

# Comparação de latência p99 entre C1 e C3 (ambos Pub/Sub)
histogram_quantile(0.99, rate(tcc_message_latency_seconds_bucket{model="pubsub"}[2m]))
```

> Assim como em C2, a distribuição por subscriber é exibida apenas no terminal — as métricas do Prometheus permanecem apenas com os labels `model` e `scenario`, sem label `subscriber`, para manter consistência metodológica com C2 (sem label `worker`) e evitar explosão de cardinalidade de séries.

---

## Validação — C4 Alta Carga (Semana 15)

> **Pré-requisito:** não execute `npm start` simultaneamente — o cenário C4 sobe seu próprio servidor de métricas na mesma porta 3001.

```bash
# 1. Infraestrutura Docker (se ainda não estiver rodando)
npm run docker:up

# 2. Executar o C4 Alta Carga
npm run scenario:c4
```

**Saída esperada no terminal:**

```
============================================================
TCC — C4 — Alta Carga
============================================================
Cenário:     c4-alta-carga
Rate:        1000 msg/s
Duration:    120s
Total msgs:  120000 por modelo
MessageSize: ~256 bytes
Modelo:      both
Consumers:   4
============================================================

[P2P] Iniciando — 120000 msgs a 1000 msg/s por 120s | 2 producers → 4 workers
...
[P2P] Concluído — 120000 enviadas | 120000 recebidas | ~12X.XXs

[Pub/Sub] Iniciando — 120000 msgs a 1000 msg/s por 120s | 2 publishers → 1 subscriber
...
[Pub/Sub] Concluído — 120000 enviadas | 120000 recebidas | ~12X.XXs

============================================================
Resumo
============================================================
P2P     | 120000 env | 120000 rec | perda: 0.0% | ~12X.XXs
         producer-1: 60000 msgs
         producer-2: 60000 msgs
         worker-1: ~30000 msgs (~25.0%)
         worker-2: ~30000 msgs (~25.0%)
         worker-3: ~30000 msgs (~25.0%)
         worker-4: ~30000 msgs (~25.0%)
Pub/Sub | 120000 env | 120000 rec | perda: 0.0% | ~12X.XXs
         publisher-1: 60000 msgs
         publisher-2: 60000 msgs

Métricas:   http://localhost:3001/metrics
Prometheus: http://localhost:9090/graph

Aguardando Ctrl+C para encerrar...
```

> **`rate` é sempre a taxa TOTAL agregada do cenário, nunca por unidade emissora.** Em C4, `rate: 1000` e `producers: 2` significam 1000 msg/s no total, divididos estaticamente entre os 2 producers (P2P) / publishers (Pub/Sub) — cada um emitindo ~500 msg/s e ~60000 mensagens (metade de `totalMessages = rate × duration = 120000`). Essa semântica é a mesma usada em C1–C3 (`rate` nunca mudou de significado entre cenários com números diferentes de unidades paralelas) e evita que `totalMessages` precise ser recalculado com base no número de producers.

> **Pub/Sub no C4 usa 1 subscriber, não 4.** O JSON de `c4-alta-carga` declara `consumers: 4` (usado pelo lado P2P, como em C2) mas **não** declara um campo `subscribers` — diferente de C3, que introduziu esse campo explicitamente para testar fan-out. Por isso, `runPubSub()` usa o valor padrão (`scenario.subscribers ?? 1` = 1) e o C4 Pub/Sub processa `120000 enviadas / 120000 recebidas`, sem multiplicação por fan-out. Essa foi uma decisão metodológica deliberada: o C3 já validou o comportamento de fan-out com múltiplos subscribers: reintroduzi-lo aqui misturaria duas variáveis (alta carga + fan-out) no mesmo cenário, dificultando isolar o efeito de cada uma.

**Validar métricas via curl** (em outro terminal, com o cenário em execução):

```bash
# Contadores de mensagens enviadas e recebidas para os dois modelos no C4
curl -s http://localhost:3001/metrics | grep 'tcc_messages.*c4-alta-carga'

# Confirmar 120000 observações de latência para cada modelo
curl -s http://localhost:3001/metrics | grep 'tcc_message_latency_seconds_count.*c4-alta-carga'
```

**Queries PromQL** (http://localhost:9090/graph, consultadas **durante** a execução para evitar `NaN` — ver nota na seção de validação do C2):

```promql
# Enviado/recebido por modelo no C4 (esperado: 120000/120000 para ambos)
tcc_messages_sent_total{scenario="c4-alta-carga"}
tcc_messages_received_total{scenario="c4-alta-carga"}

# Latência p50 do P2P no C4
histogram_quantile(0.50, rate(tcc_message_latency_seconds_bucket{model="p2p", scenario="c4-alta-carga"}[2m]))

# Latência p99 do P2P no C4 — espera-se degradação visível frente ao C1/C2 sob 1000 msg/s
histogram_quantile(0.99, rate(tcc_message_latency_seconds_bucket{model="p2p", scenario="c4-alta-carga"}[2m]))

# Comparação p99 entre P2P e Pub/Sub sob alta carga
histogram_quantile(0.99, rate(tcc_message_latency_seconds_bucket{scenario="c4-alta-carga"}[2m]))
```

> Nenhum label `producer`/`publisher`/`worker`/`subscriber` foi adicionado nas métricas — mesma disciplina de C2/C3. A distribuição por producer/publisher/worker é exibida apenas no terminal.

> **Sem batch sending nesta implementação.** O `rateTicker` (`src/load-runner/rate.js`) não foi alterado — cada producer/publisher em C4 emite a ~500 msg/s usando o mesmo mecanismo de `setTimeout` já validado em C1–C3. Se a validação empírica mostrar degradação relevante na taxa efetiva (tempo decorrido muito acima de 120s, ou throughput real abaixo do esperado), isso deve ser reportado como limitação conhecida — a introdução de batch sending exigiria alterar `rate.js`/`producer.js`/`publisher.js`, fora do escopo desta etapa.

---

## Validação — C5 Falha de Consumidor (Semana 16)

> **Pré-requisito:** não execute `npm start` simultaneamente — o cenário C5 sobe seu próprio servidor de métricas na mesma porta 3001.

```bash
# 1. Infraestrutura Docker (se ainda não estiver rodando)
npm run docker:up

# 2. Executar o C5 Falha de Consumidor
npm run scenario:c5
```

**Objetivo:** avaliar a diferença de comportamento entre P2P (Redis Streams) e Pub/Sub (Redis Pub/Sub) diante da falha temporária de um consumidor/subscriber. Uma falha é simulada entre `failureAt=30s` e `failureAt+failureDuration=50s` (janela de 30s–50s) durante uma execução de `rate=50 msg/s` por `duration=90s` (`totalMessages = 4500` por modelo).

**Resultado observado — P2P:**

```
P2P     | 4500 env | 4500 rec | perda: 0.0% | redelivered: 1 | pendingFinal: 0 | 93.81s
         worker-1: 720 msgs (16.0%)
         worker-2: 3779 msgs (84.0%)
         recuperadas via XAUTOCLAIM: 1
```

`worker-1` é deliberadamente interrompido logo após ler um lote via `XREADGROUP`, sem confirmar via `XACK` — essa(s) mensagem(ns) ficam pendentes no PEL (Pending Entries List) do consumer group. Após a janela de falha, uma varredura única via `XAUTOCLAIM` reatribui e confirma essas mensagens em nome de `worker-2`, incrementando `tcc_messages_redelivered_total`. Ao final, `XPENDING` confirma **0 mensagens pendentes** (`pendingFinal`) — recuperação completa, sem perda.

> **Por que `redelivered` é pequeno (1), não ~1000?** Diferente do Pub/Sub, no P2P apenas **um** dos dois workers falha — o stream continua sendo um pool compartilhado, e o worker saudável (`worker-2`) segue consumindo normalmente mensagens novas durante toda a janela de falha. O que fica pendente é só o lote que `worker-1` tinha em mãos no instante exato da queda (limitado pelo `COUNT` do `XREADGROUP`, não pela duração da janela de falha). **Não espere `redelivered` próximo de `rate × failureDuration`** — essa conta só se aplica à perda do Pub/Sub, não à reentrega do P2P.

**Resultado observado — Pub/Sub:**

```
Pub/Sub | 4500 env | 3540 rec | perda: 21.3% | lost: 960 | redelivered: 0 | 93.88s
         falha simulada: 30s–50s
         antes da falha: 1439 msgs recebidas
         após reconexão: 2101 msgs recebidas
```

O subscriber único é desconectado em `failureAt=30s` e reconectado em `failureAt+failureDuration=50s`. O publisher continua publicando normalmente durante toda a janela — como o Redis Pub/Sub não tem persistência nem reentrega, as mensagens publicadas enquanto o subscriber está offline são **perdidas permanentemente** para ele. `lost` é medido como a diferença do contador `tcc_messages_sent_total` entre o instante da desconexão e o da reconexão (`sentAtReconnect - sentAtDisconnect`), não por uma estimativa fixa — confirma-se que `received + lost = sent` (`3540 + 960 = 4500`).

> **Por que `lost=960`, não exatamente `1000`?** `960` está próximo de `rate × failureDuration = 50 × 20 = 1000`, mas não precisa ser exatamente esse valor — há variação real de timing no event loop (mesma categoria de variação já documentada em C1–C4). O valor usado na métrica é sempre o medido ao vivo via contadores, nunca a estimativa analítica.

**O que o C5 demonstra — diferença metodológica central entre os modelos:**

| | P2P / Redis Streams | Pub/Sub / Redis Pub/Sub |
|---|---|---|
| O que acontece com mensagens em trânsito na falha | Ficam pendentes no PEL (persistidas) | São descartadas (sem persistência) |
| Após a falha | Recuperáveis via `XCLAIM`/`XAUTOCLAIM` | Perdidas para sempre |
| Resultado final | `received = sent` (0% perda real) | `received < sent` (perda real) |
| Métrica incrementada | `tcc_messages_redelivered_total` | `tcc_messages_lost_total` |

**Validar métricas via curl** (em outro terminal, com o cenário em execução):

```bash
curl -s http://localhost:3001/metrics | grep 'tcc_messages.*c5-falha-consumidor'
```

Valores confirmados nesta validação:
```
tcc_messages_sent_total{model="p2p",scenario="c5-falha-consumidor"} 4500
tcc_messages_sent_total{model="pubsub",scenario="c5-falha-consumidor"} 4500
tcc_messages_received_total{model="p2p",scenario="c5-falha-consumidor"} 4500
tcc_messages_received_total{model="pubsub",scenario="c5-falha-consumidor"} 3540
tcc_messages_redelivered_total{model="p2p",scenario="c5-falha-consumidor"} 1
tcc_messages_lost_total{model="pubsub",scenario="c5-falha-consumidor"} 960
```

**Queries PromQL** (http://localhost:9090/graph, consultadas **durante** a execução para evitar `NaN` — ver nota na seção de validação do C2):

```promql
# Reentregas no P2P do C5 (esperado: pequeno, > 0)
tcc_messages_redelivered_total{scenario="c5-falha-consumidor"}

# Perdas no Pub/Sub do C5 (esperado: próximo de rate × failureDuration)
tcc_messages_lost_total{scenario="c5-falha-consumidor"}

# Enviadas vs recebidas por modelo no C5
tcc_messages_sent_total{scenario="c5-falha-consumidor"}
tcc_messages_received_total{scenario="c5-falha-consumidor"}
```

> Nenhum label `worker`/`subscriber` foi adicionado nas métricas — mesma disciplina de C2–C4. A distribuição por worker e o detalhamento da janela de falha são exibidos apenas no terminal.

---

## Próximos Passos

1. ~~Implementar a configuração central e conexão Redis em `src/common/`.~~ ✓ Concluído
2. ~~Implementar o produtor e consumidor P2P (`src/p2p/`).~~ ✓ Concluído
3. ~~Implementar o publisher e subscriber Pub/Sub (`src/pubsub/`).~~ ✓ Concluído
4. ~~Implementar o load-runner parametrizado (`src/load-runner/`) — C1 Baseline.~~ ✓ Concluído
5. ~~Implementar C2 — Fila de Tarefas no load-runner.~~ ✓ Concluído
6. ~~Implementar C3 — Disseminação de Eventos no load-runner.~~ ✓ Concluído
7. ~~Implementar C4 — Alta Carga no load-runner (múltiplos producers/publishers).~~ ✓ Concluído
8. ~~Implementar C5 — Falha de Consumidor no load-runner (P2P com PEL/XAUTOCLAIM, Pub/Sub com perda medida via counters).~~ ✓ Concluído
9. Criar o implementation-log da Semana 16.
10. Configurar datasource e dashboards no Grafana.
11. Consolidar os resultados de C1–C5 e redigir a análise comparativa P2P vs. Pub/Sub para o TCC.

