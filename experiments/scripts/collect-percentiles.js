// Coleta automatizada de percentis p50/p95/p99 para os cenários C1–C5.
//
// Roda cada cenário via `node src/load-runner/run.js <id>`, observa o stdout para
// detectar quando cada perna (P2P/Pub/Sub) começa, aguarda um delay calibrado por
// cenário/modelo para deixar o regime permanente se estabelecer, e consulta o
// Prometheus via HTTP API — sem tocar em scenario-runner.js nem nos módulos de
// protocolo. O processo do cenário só é encerrado (SIGINT) depois que ele sinaliza
// conclusão natural ("Aguardando Ctrl+C para encerrar..."); SIGINT/SIGKILL antes
// disso só acontece como fallback de um watchdog de segurança.

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdirSync, writeFileSync } from 'node:fs';

const PROM_BASE = 'http://localhost:9090';
const PERCENTILES = [0.50, 0.95, 0.99];
const WATCHDOG_MS = 10 * 60 * 1000; // segurança absoluta por execução, não o fluxo normal
const KILL_GRACE_MS = 15_000;

const PLAN = [
  { scenario: 'c1-baseline', models: ['p2p', 'pubsub'], runs: 1 },
  { scenario: 'c2-fila-tarefas', models: ['p2p'], runs: 1 },
  { scenario: 'c3-disseminacao-eventos', models: ['pubsub'], runs: 1 },
  { scenario: 'c4-alta-carga', models: ['p2p', 'pubsub'], runs: 2 },
  { scenario: 'c5-falha-consumidor', models: ['p2p', 'pubsub'], runs: 1 },
];

// Delay por cenário/modelo entre o início da perna e a consulta — calibrado para
// cada cenário individualmente, não um valor único (pernas têm durações distintas).
const COLLECTION_DELAY_MS = {
  'c1-baseline:p2p': 40_000,
  'c1-baseline:pubsub': 40_000,
  'c2-fila-tarefas:p2p': 40_000,
  'c3-disseminacao-eventos:pubsub': 40_000,
  'c4-alta-carga:p2p': 75_000,
  'c4-alta-carga:pubsub': 75_000,
  'c5-falha-consumidor:p2p': 70_000,
  'c5-falha-consumidor:pubsub': 70_000,
};

const OUTPUT_JSON = 'experiments/results/percentis-automatizados.json';
const OUTPUT_MD = 'experiments/results/percentis-automatizados.md';

// Erro explícito para quando o processo do cenário encerra sozinho (crash, erro de
// conexão etc.) antes de sinalizar conclusão natural — distinto de uma falha de
// coleta de percentil pontual, que já é tratada por modelo em collectPercentiles().
class ScenarioProcessError extends Error {
  constructor(scenario, run, code, signal) {
    super(`${scenario}#${run} — processo encerrou inesperadamente antes de concluir (code=${code}, signal=${signal})`);
    this.name = 'ScenarioProcessError';
    this.scenario = scenario;
    this.run = run;
    this.code = code;
    this.signal = signal;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPromQL(p, model, scenario) {
  return `histogram_quantile(${p}, rate(tcc_message_latency_seconds_bucket{model="${model}", scenario="${scenario}"}[2m]))`;
}

async function queryPrometheus(promql) {
  const url = `${PROM_BASE}/api/v1/query?query=${encodeURIComponent(promql)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Prometheus respondeu HTTP ${res.status}`);
  const json = await res.json();
  if (json.status !== 'success') throw new Error(`Prometheus status: ${json.status}`);
  const raw = json.data?.result?.[0]?.value?.[1];
  if (raw === undefined) return { raw: undefined, value: null };
  const value = Number(raw);
  return { raw, value };
}

async function preflightCheck() {
  try {
    const res = await fetch(`${PROM_BASE}/-/healthy`);
    if (!res.ok) throw new Error(`status HTTP ${res.status}`);
  } catch (err) {
    console.error('\n[collect-percentiles] Prometheus não está acessível em ' + PROM_BASE + '.');
    console.error('[collect-percentiles] Rode "npm run docker:up" e tente novamente.');
    console.error(`[collect-percentiles] Detalhe: ${err.message}`);
    process.exit(1);
  }
}

async function collectPercentiles(scenario, model) {
  const delayMs = COLLECTION_DELAY_MS[`${scenario}:${model}`];
  await sleep(delayMs);

  const entry = {
    scenario,
    model,
    p50: null,
    p95: null,
    p99: null,
    collectedAt: new Date().toISOString(),
    collectionDelayMs: delayMs,
    queries: {},
    status: 'ok',
  };

  for (const p of PERCENTILES) {
    const key = `p${Math.round(p * 100)}`;
    const promql = buildPromQL(p, model, scenario);
    entry.queries[key] = promql;

    try {
      const { raw, value } = await queryPrometheus(promql);
      entry[key] = value;
      if (raw === undefined) {
        entry.status = 'sem-serie';
      } else if (Number.isNaN(value) && entry.status === 'ok') {
        entry.status = 'nan';
      }
    } catch (err) {
      entry[key] = null;
      entry.status = 'erro';
      entry.error = err.message;
    }
  }

  return entry;
}

function runScenarioOnce(scenario, models, run) {
  return new Promise((resolve, reject) => {
    console.log(`\n=== ${scenario} — execução ${run} ===`);

    const child = spawn('node', ['src/load-runner/run.js', scenario], {
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    const rl = createInterface({ input: child.stdout });

    const results = [];
    const collectionPromises = [];
    const triggered = new Set();
    let finishing = false;

    const scheduleCollection = (model) => {
      if (triggered.has(model)) return;
      triggered.add(model);
      console.log(`[collect-percentiles] ${scenario}:${model} — perna detectada, aguardando ${COLLECTION_DELAY_MS[`${scenario}:${model}`]}ms antes de consultar`);

      const p = collectPercentiles(scenario, model)
        .then((entry) => {
          console.log(`[collect-percentiles] ${scenario}:${model} — coletado (status: ${entry.status})`);
          results.push({ ...entry, run });
        })
        .catch((err) => {
          console.error(`[collect-percentiles] ${scenario}:${model} — erro: ${err.message}`);
          results.push({
            scenario, model, run, status: 'erro', error: err.message,
            collectedAt: new Date().toISOString(),
            collectionDelayMs: COLLECTION_DELAY_MS[`${scenario}:${model}`],
          });
        });
      collectionPromises.push(p);
    };

    const finishUp = async (reason) => {
      if (finishing) return;
      finishing = true;
      clearTimeout(watchdog);

      if (reason === 'watchdog') {
        console.warn(`[collect-percentiles] ${scenario}#${run} — watchdog de ${WATCHDOG_MS}ms disparado, encerrando à força`);
      }

      // Garante que nenhuma coleta agendada ficou pendente antes de derrubar o processo.
      await Promise.allSettled(collectionPromises);

      child.kill('SIGINT');
      const killTimer = setTimeout(() => {
        console.warn(`[collect-percentiles] ${scenario}#${run} — não encerrou ${KILL_GRACE_MS}ms após SIGINT, enviando SIGKILL`);
        child.kill('SIGKILL');
      }, KILL_GRACE_MS);

      child.once('exit', () => {
        clearTimeout(killTimer);
        resolve(results);
      });
    };

    // Saída inesperada do processo filho (crash, erro de conexão etc.) antes de
    // finishUp ter sido acionado — diferente do exit disparado pelo próprio finishUp
    // após o SIGINT/SIGKILL normal, que é ignorado aqui porque `finishing` já é true
    // nesse ponto. 'exit' e 'close' podem ambos disparar para a mesma saída; o guard
    // de `finishing` garante que só a primeira ocorrência é tratada.
    const onUnexpectedExit = (code, signal) => {
      if (finishing) return;
      finishing = true;
      clearTimeout(watchdog);
      const err = new ScenarioProcessError(scenario, run, code, signal);
      console.error(`[collect-percentiles] ${err.message}`);
      reject(err);
    };
    child.on('exit', onUnexpectedExit);
    child.on('close', onUnexpectedExit);

    rl.on('line', (line) => {
      process.stdout.write(`[${scenario}#${run}] ${line}\n`);
      if (line.includes('[P2P] Iniciando') && models.includes('p2p')) scheduleCollection('p2p');
      if (line.includes('[Pub/Sub] Iniciando') && models.includes('pubsub')) scheduleCollection('pubsub');
      // Marca o fim natural da execução — só então o processo é encerrado.
      if (line.includes('Aguardando Ctrl+C')) finishUp('completed');
    });

    const watchdog = setTimeout(() => finishUp('watchdog'), WATCHDOG_MS);

    child.on('error', reject);
  });
}

function formatMs(valueSeconds) {
  if (valueSeconds === null || valueSeconds === undefined) return '—';
  if (Number.isNaN(valueSeconds)) return 'NaN';
  return `${(valueSeconds * 1000).toFixed(3)}ms`;
}

function statusObservacao(entry) {
  switch (entry.status) {
    case 'ok': return '';
    case 'nan': return 'histogram_quantile retornou NaN';
    case 'sem-serie': return 'sem série no Prometheus';
    case 'erro': return `erro na consulta: ${entry.error ?? ''}`;
    case 'processo-encerrado-inesperadamente': return `processo encerrou antes de concluir (code=${entry.code}, signal=${entry.signal})`;
    default: return entry.status;
  }
}

function toMarkdown(results) {
  const header = '| Cenário | Modelo | Execução | p50 | p95 | p99 | Observação |\n|---|---|---|---|---|---|---|\n';
  const rows = results
    .map((r) => `| ${r.scenario} | ${r.model} | ${r.run} | ${formatMs(r.p50)} | ${formatMs(r.p95)} | ${formatMs(r.p99)} | ${statusObservacao(r)} |`)
    .join('\n');
  return `# Percentis Automatizados — Coleta de Latência (p50/p95/p99)\n\nGerado em: ${new Date().toISOString()}\n\nValores em milissegundos, convertidos a partir dos segundos retornados pelo Prometheus (ver JSON para os valores brutos em segundos e as queries exatas usadas).\n\n${header}${rows}\n`;
}

function writeOutputs(results) {
  mkdirSync('experiments/results', { recursive: true });
  writeFileSync(OUTPUT_JSON, JSON.stringify(results, null, 2));
  writeFileSync(OUTPUT_MD, toMarkdown(results));
}

async function main() {
  await preflightCheck();

  const allResults = [];
  for (const { scenario, models, runs } of PLAN) {
    for (let run = 1; run <= runs; run++) {
      try {
        const results = await runScenarioOnce(scenario, models, run);
        allResults.push(...results);
      } catch (err) {
        if (err instanceof ScenarioProcessError) {
          console.error(`[collect-percentiles] ${scenario}#${run} — execução falhou, seguindo para a próxima`);
          allResults.push({
            scenario,
            model: '(processo)',
            run,
            status: 'processo-encerrado-inesperadamente',
            error: err.message,
            code: err.code,
            signal: err.signal,
            collectedAt: new Date().toISOString(),
          });
        } else {
          throw err; // erro não esperado (ex. falha ao spawnar o processo) — aborta o plano
        }
      }
      writeOutputs(allResults); // gravação incremental — sobrevive a interrupções no meio do plano
    }
  }

  console.log(`\n[collect-percentiles] Coleta concluída. Resultados em ${OUTPUT_JSON} e ${OUTPUT_MD}`);
}

main().catch((err) => {
  console.error('[collect-percentiles] Falha não tratada:', err);
  process.exit(1);
});
