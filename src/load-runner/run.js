import { runScenario } from './scenario-runner.js';
import { disconnect } from '../common/redis.js';

const scenarioId = process.argv[2];

if (!scenarioId) {
  console.error('[runner] Erro: informe o ID do cenário como argumento.');
  console.error('[runner] Exemplo: node src/load-runner/run.js c1-baseline');
  process.exit(1);
}

const { server } = await runScenario(scenarioId);

process.on('SIGINT', async () => {
  console.log('\n[runner] Encerrando...');
  await disconnect();
  server.close();
  process.exit(0);
});
