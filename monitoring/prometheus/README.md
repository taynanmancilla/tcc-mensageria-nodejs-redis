# Prometheus — Coleta de Métricas

> Configuração em desenvolvimento.

## Descrição

O Prometheus será responsável por coletar e armazenar as métricas expostas pelos componentes Node.js via `prom-client`.

## Configuração Prevista

- Arquivo de configuração: `monitoring/prometheus/prometheus.yml` (a criar).
- Scrape interval: a definir.
- Targets: endpoints `/metrics` dos produtores, consumidores e load-runner.

## Métricas Coletadas

Consulte [`docs/metricas.md`](../../docs/metricas.md) para a lista completa de métricas planejadas.

## Status

A configuração do Prometheus ainda não foi implementada. O arquivo `prometheus.yml` será criado junto com a configuração do Docker Compose.
