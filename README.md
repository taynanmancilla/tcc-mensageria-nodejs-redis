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

> **Fase: Protótipo básico validado (Semana 12)**

- [x] Estrutura de pastas definida
- [x] Documentação inicial criada
- [x] Dependências declaradas (`package.json`)
- [x] Docker Compose configurado com Redis, Prometheus e Grafana
- [x] `src/common/` — config, conexão Redis e servidor `/metrics` implementados
- [x] `src/p2p/` — producer e consumer P2P (Redis Streams) implementados
- [x] `src/pubsub/` — publisher e subscriber Pub/Sub implementados
- [x] `src/prototypes/basic.js` — protótipo básico executável (Semana 12)
- [ ] Implementação do load-runner parametrizado (`src/load-runner/`)
- [ ] Configuração de dashboards no Grafana
- [ ] Execução dos cenários experimentais (C1–C5)

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

## Próximos Passos

1. ~~Implementar a configuração central e conexão Redis em `src/common/`.~~ ✓ Concluído
2. ~~Implementar o produtor e consumidor P2P (`src/p2p/`).~~ ✓ Concluído
3. ~~Implementar o publisher e subscriber Pub/Sub (`src/pubsub/`).~~ ✓ Concluído
4. Implementar o load-runner parametrizado (`src/load-runner/`) com leitura dos cenários C1–C5.
5. Configurar datasource e dashboards no Grafana.
6. Executar os cenários C1–C5 e coletar os resultados.

