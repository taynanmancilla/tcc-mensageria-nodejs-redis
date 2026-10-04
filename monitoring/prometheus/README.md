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
| `nodejs-app` | `host.docker.internal:3001` | **UP** |

> O target `nodejs-app` fica **UP** assim que o processo Node.js (protótipo ou qualquer cenário `scenario:c1`–`scenario:c5`) sobe e expõe o endpoint `/metrics` via `prom-client` na porta `3001`. Se aparecer como DOWN, confirme que algum desses processos está em execução.

## Como subir

```bash
npm run docker:up
```

## Métricas Coletadas

Consulte [`docs/metricas.md`](../../docs/metricas.md) para a lista completa de métricas implementadas e seu uso nos cenários C1–C5, e o [`README.md`](../../README.md) principal para os valores validados em cada cenário.

## Próximo passo

Configurar datasource e dashboards no Grafana (item ainda pendente, conforme o `README.md` principal).
