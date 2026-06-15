# Grafana — Visualização de Métricas

## Descrição

O Grafana é utilizado para visualizar as métricas coletadas pelo Prometheus e comparar o comportamento dos modelos P2P e Pub/Sub nos diferentes cenários experimentais. É iniciado como um container Docker gerenciado pelo `docker-compose.yml`.

## Acesso

- **URL local:** http://localhost:3000
- **Usuário:** `admin`
- **Senha:** `admin`

> As credenciais acima são apenas para o ambiente local de desenvolvimento. Não utilize em produção.

## Como subir

```bash
npm run docker:up
```

## Configuração de Datasource

Após subir os containers, configure manualmente o datasource do Prometheus no Grafana:

1. Acesse http://localhost:3000 e faça login.
2. Vá em **Connections → Data sources → Add data source**.
3. Selecione **Prometheus**.
4. Informe a URL: `http://tcc-prometheus:9090`.
5. Clique em **Save & test**.

## Dashboards

Os dashboards comparativos entre P2P e Pub/Sub serão criados em etapa futura, após a instrumentação dos componentes Node.js com `prom-client`.

## Próximo passo

Criar dashboards após implementar o endpoint `/metrics` na aplicação.
