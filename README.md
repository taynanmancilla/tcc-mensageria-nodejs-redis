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

> **Fase: Estruturação inicial do projeto**

- [x] Estrutura de pastas definida
- [x] Documentação inicial criada
- [x] Dependências declaradas (`package.json`)
- [ ] Docker Compose configurado com Redis
- [ ] Implementação do produtor/consumidor P2P
- [ ] Implementação do publisher/subscriber Pub/Sub
- [ ] Implementação do load-runner
- [ ] Instrumentação com Prometheus
- [ ] Configuração de dashboards no Grafana
- [ ] Execução dos cenários experimentais

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

---

## Próximos Passos

1. Configurar o `docker-compose.yml` com Redis, Prometheus e Grafana.
2. Implementar a conexão base com o Redis em `src/common/redis/`.
3. Implementar o produtor e consumidor P2P (`src/p2p/`).
4. Implementar o publisher e subscriber Pub/Sub (`src/pubsub/`).
5. Implementar o load-runner (`src/load-runner/`).
6. Instrumentar os componentes com `prom-client`.
7. Executar os cenários C1–C5 e coletar os resultados.

