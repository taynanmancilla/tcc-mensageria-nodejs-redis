# Prometheus — Coleta de Métricas

## Descrição

O Prometheus é responsável por coletar e armazenar as métricas expostas pelos componentes Node.js via `prom-client`. É iniciado como um container Docker gerenciado pelo `docker-compose.yml`.

## Acesso

- **URL local:** http://localhost:9090

## Configuração

O arquivo de configuração é `monitoring/prometheus/prometheus.yml`.

### Targets configurados

| Job | Target | Status atual |
|-----|--------|--------------|
| `prometheus` | `localhost:9090` | Ativo |
| `nodejs-app` | `host.docker.internal:3001` | **DOWN** (esperado nesta fase) |

> O target `nodejs-app` ficará com status **DOWN** no Prometheus enquanto a aplicação Node.js não implementar o endpoint `/metrics` via `prom-client`. Esse comportamento é esperado e não indica erro de configuração.

## Como subir

```bash
npm run docker:up
```

## Métricas Coletadas (previstas)

Consulte [`docs/metricas.md`](../../docs/metricas.md) para a lista completa de métricas planejadas.

## Próximo passo

Implementar o endpoint `/metrics` na aplicação Node.js (porta `3001`) usando `prom-client`.
