# Grafana — Visualização de Métricas

> Configuração em desenvolvimento.

## Descrição

O Grafana será utilizado para visualizar as métricas coletadas pelo Prometheus e comparar o comportamento dos modelos P2P e Pub/Sub nos diferentes cenários experimentais.

## Configuração Prevista

- Datasource: Prometheus (configurado via `docker-compose.yml`).
- Dashboards: a serem criados para comparação de latência, throughput, uso de CPU e memória.

## Status

A configuração do Grafana ainda não foi implementada. Os dashboards serão criados após a instrumentação dos componentes Node.js.
