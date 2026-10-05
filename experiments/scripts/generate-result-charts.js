// Gera os 3 gráficos essenciais da seção de Resultados da monografia, a partir
// apenas dos números já consolidados em docs/resultados-consolidados.md.
//
// Não usa nenhuma biblioteca de gráficos: monta SVG puro em memória, embrulha
// num HTML mínimo e tira um screenshot via Chrome headless (já instalado no
// sistema) — evita adicionar qualquer dependência nova ao package.json.
//
// Paleta categórica validada via o skill de dataviz (2 cores, slots 1/2 do
// tema padrão): P2P = azul, Pub/Sub = laranja, em ordem fixa nos 3 gráficos.
// Pub/Sub também recebe uma textura de hachura diagonal (tone-on-tone) para
// permanecer distinguível em impressão P&B — comum em monografias.

import { writeFileSync, mkdirSync, unlinkSync, rmdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const OUT_DIR = 'docs/assets/resultados';
const TMP_DIR = `${OUT_DIR}/.tmp`; // HTML intermediário, removido ao final — nunca toca experiments/results/
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCALE = 2; // --force-device-scale-factor, para PNG em boa resolução (~2x)

const COLORS = {
  p2p: '#2a78d6',
  pubsub: '#eb6834',
  pubsubDark: '#a8481f',
  good: '#0ca30c',
  critical: '#d03b3b',
  criticalDark: '#8f2626',
  ink: '#0b0b0b',
  secondaryInk: '#52514e',
  mutedInk: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  surface: '#ffffff',
};

const FONT = 'font-family="system-ui, -apple-system, Segoe UI, sans-serif"';

function num(v, decimals = 1) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// --- Defs compartilhados: textura de hachura para a série Pub/Sub ---------
function defs() {
  return `
  <defs>
    <pattern id="hatch-pubsub" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="7" height="7" fill="${COLORS.pubsub}"/>
      <line x1="0" y1="0" x2="0" y2="7" stroke="${COLORS.pubsubDark}" stroke-width="2"/>
    </pattern>
    <pattern id="hatch-critical" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="7" height="7" fill="${COLORS.critical}"/>
      <line x1="0" y1="0" x2="0" y2="7" stroke="${COLORS.criticalDark}" stroke-width="2"/>
    </pattern>
  </defs>`;
}

function wrapHtml(title, svg, width, height) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>
    html,body{margin:0;padding:0;background:#ffffff;}
    svg{display:block;}
  </style></head>
  <body><svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${svg}</svg></body></html>`;
}

function renderToPng(htmlName, html, outPngPath, width, height) {
  mkdirSync(TMP_DIR, { recursive: true });
  const htmlPath = `${TMP_DIR}/${htmlName}`;
  writeFileSync(htmlPath, html);
  execFileSync(CHROME, [
    '--headless',
    '--disable-gpu',
    `--force-device-scale-factor=${SCALE}`,
    `--window-size=${width},${height}`,
    `--screenshot=${outPngPath}`,
    `file://${process.cwd()}/${htmlPath}`,
  ], { stdio: 'ignore' });
  unlinkSync(htmlPath);
}

// ---------------------------------------------------------------------------
// Gráfico 1 — Throughput efetivo por cenário e modelo (2 painéis: baixa/média
// carga e C4 isolado, por causa da diferença de ~20x em ordem de grandeza —
// um único eixo linear não comportaria os dois grupos de forma legível).
// ---------------------------------------------------------------------------
function chart1() {
  const width = 1100, height = 560;
  const panelW = 480, panelH = 360, gapBetweenPanels = 60;
  const marginLeft = 70, marginTop = 90;

  const dataLow = [
    { label: 'C1', p2p: { v: 9.9 }, pubsub: { v: 9.9 } },
    { label: 'C2', p2p: { min: 45.8, max: 47.1 }, pubsub: null },
    { label: 'C3', p2p: null, pubsub: { min: 46.8, max: 47.9 } },
    { label: 'C5', p2p: { v: 48.0 }, pubsub: { v: 47.9 } },
  ];
  const dataHigh = [
    { label: 'C4', p2p: { min: 979, max: 1187 }, pubsub: { min: 843, max: 927 } },
  ];

  function panel(ox, oy, data, yMax, yStep, panelTitle) {
    const plotLeft = ox + marginLeft, plotTop = oy + 30, plotBottom = oy + panelH - 50;
    const plotHeight = plotBottom - plotTop;
    const plotWidth = panelW - marginLeft - 20;
    const groupW = plotWidth / data.length;
    const barW = Math.min(46, groupW * 0.32);

    let s = `<text x="${ox + panelW / 2}" y="${oy + 12}" text-anchor="middle" ${FONT} font-size="15" font-weight="600" fill="${COLORS.ink}">${panelTitle}</text>`;

    // grade e eixo Y
    for (let t = 0; t <= yMax; t += yStep) {
      const y = plotBottom - (t / yMax) * plotHeight;
      s += `<line x1="${plotLeft}" y1="${y}" x2="${plotLeft + plotWidth}" y2="${y}" stroke="${COLORS.grid}" stroke-width="1"/>`;
      s += `<text x="${plotLeft - 10}" y="${y + 4}" text-anchor="end" ${FONT} font-size="11" fill="${COLORS.mutedInk}">${t}</text>`;
    }
    s += `<line x1="${plotLeft}" y1="${plotBottom}" x2="${plotLeft + plotWidth}" y2="${plotBottom}" stroke="${COLORS.axis}" stroke-width="1.5"/>`;
    s += `<text x="${ox + 18}" y="${oy + panelH / 2}" text-anchor="middle" ${FONT} font-size="11" fill="${COLORS.secondaryInk}" transform="rotate(-90 ${ox + 18} ${oy + panelH / 2})">msg/s</text>`;

    data.forEach((d, i) => {
      const gx = plotLeft + i * groupW + groupW / 2;
      const drawBar = (entry, dx, fill, label) => {
        if (!entry) return;
        const val = entry.v ?? entry.max;
        const h = (val / yMax) * plotHeight;
        const x = gx + dx - barW / 2;
        const y = plotBottom - h;
        s += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${fill}"/>`;
        if (entry.min !== undefined) {
          const yMin = plotBottom - (entry.min / yMax) * plotHeight;
          const cx = x + barW / 2;
          s += `<line x1="${cx}" y1="${y}" x2="${cx}" y2="${yMin}" stroke="${COLORS.ink}" stroke-width="1.5"/>`;
          s += `<line x1="${cx - 6}" y1="${yMin}" x2="${cx + 6}" y2="${yMin}" stroke="${COLORS.ink}" stroke-width="1.5"/>`;
          s += `<text x="${cx}" y="${y - 8}" text-anchor="middle" ${FONT} font-size="10.5" fill="${COLORS.ink}">${num(entry.min, 0)}–${num(entry.max, 0)}</text>`;
        } else {
          s += `<text x="${x + barW / 2}" y="${y - 8}" text-anchor="middle" ${FONT} font-size="10.5" fill="${COLORS.ink}">${num(entry.v, 1)}</text>`;
        }
      };
      drawBar(d.p2p, -barW / 2 - 3, COLORS.p2p, 'P2P');
      drawBar(d.pubsub, barW / 2 + 3, 'url(#hatch-pubsub)', 'Pub/Sub');
      s += `<text x="${gx}" y="${plotBottom + 22}" text-anchor="middle" ${FONT} font-size="12.5" fill="${COLORS.ink}">${d.label}</text>`;
    });
    return s;
  }

  let svg = defs();
  svg += `<text x="${width / 2}" y="28" text-anchor="middle" ${FONT} font-size="19" font-weight="700" fill="${COLORS.ink}">Throughput efetivo por cenário e modelo</text>`;
  svg += panel(20, marginTop, dataLow, 60, 10, 'C1, C2, C3, C5 — baixa/média carga');
  svg += panel(20 + panelW + gapBetweenPanels, marginTop, dataHigh, 1300, 200, 'C4 — alta carga (escala própria)');

  // legenda
  const legY = height - 34;
  svg += `<rect x="${width/2 - 150}" y="${legY}" width="16" height="16" fill="${COLORS.p2p}"/>`;
  svg += `<text x="${width/2 - 128}" y="${legY + 13}" ${FONT} font-size="13" fill="${COLORS.ink}">P2P</text>`;
  svg += `<rect x="${width/2 + 10}" y="${legY}" width="16" height="16" fill="url(#hatch-pubsub)"/>`;
  svg += `<text x="${width/2 + 32}" y="${legY + 13}" ${FONT} font-size="13" fill="${COLORS.ink}">Pub/Sub</text>`;
  svg += `<text x="${width / 2}" y="${height - 8}" text-anchor="middle" ${FONT} font-size="10.5" fill="${COLORS.mutedInk}">Barras com intervalo min–max representam variação entre execuções repetidas (ver docs/resultados-consolidados.md, seção 4).</text>`;

  return wrapHtml('Throughput efetivo', svg, width, height);
}

// ---------------------------------------------------------------------------
// Gráfico 2 — Latência p50/p95/p99 por cenário e modelo (3 painéis).
// ---------------------------------------------------------------------------
function chart2() {
  const width = 1500, height = 480;
  const panelW = 460, panelH = 320, gap = 40;
  const marginLeft = 55;

  const DATA = {
    p50: [
      { label: 'C1', p2p: { v: 2.962 }, pubsub: { v: 2.935 } },
      { label: 'C2', p2p: { v: 2.751 }, pubsub: null },
      { label: 'C3', p2p: null, pubsub: { v: 2.715 } },
      { label: 'C4', p2p: { min: 0.507, max: 0.513 }, pubsub: { min: 0.550, max: 0.573 } },
      { label: 'C5', p2p: { v: 2.728 }, pubsub: { v: 2.136 } },
    ],
    p95: [
      { label: 'C1', p2p: { v: 4.807 }, pubsub: { v: 4.793 } },
      { label: 'C2', p2p: { v: 4.785 }, pubsub: null },
      { label: 'C3', p2p: null, pubsub: { v: 4.771 } },
      { label: 'C4', p2p: { min: 0.963, max: 0.974 }, pubsub: { min: 2.790, max: 3.429 } },
      { label: 'C5', p2p: { v: 4.777 }, pubsub: { v: 4.721 } },
    ],
    p99: [
      { label: 'C1', p2p: { v: 4.971 }, pubsub: { v: 4.959 } },
      { label: 'C2', p2p: { v: 4.966 }, pubsub: null },
      { label: 'C3', p2p: null, pubsub: { v: 4.954 } },
      { label: 'C4', p2p: { min: 1.928, max: 3.400 }, pubsub: { min: 4.566, max: 4.692 } },
      { label: 'C5', p2p: { v: 4.959 }, pubsub: { v: 4.951 } },
    ],
  };
  const yMax = 5.5, yStep = 1;

  function panel(ox, oy, data, panelTitle) {
    const plotLeft = ox + marginLeft, plotTop = oy + 34, plotBottom = oy + panelH - 44;
    const plotHeight = plotBottom - plotTop;
    const plotWidth = panelW - marginLeft - 16;
    const groupW = plotWidth / data.length;
    const barW = Math.min(26, groupW * 0.30);

    let s = `<text x="${ox + panelW / 2}" y="${oy + 14}" text-anchor="middle" ${FONT} font-size="15" font-weight="600" fill="${COLORS.ink}">${panelTitle}</text>`;

    for (let t = 0; t <= yMax + 0.001; t += yStep) {
      const y = plotBottom - (t / yMax) * plotHeight;
      s += `<line x1="${plotLeft}" y1="${y}" x2="${plotLeft + plotWidth}" y2="${y}" stroke="${COLORS.grid}" stroke-width="1"/>`;
      s += `<text x="${plotLeft - 8}" y="${y + 4}" text-anchor="end" ${FONT} font-size="10.5" fill="${COLORS.mutedInk}">${t}</text>`;
    }
    s += `<line x1="${plotLeft}" y1="${plotBottom}" x2="${plotLeft + plotWidth}" y2="${plotBottom}" stroke="${COLORS.axis}" stroke-width="1.5"/>`;
    s += `<text x="${ox + 14}" y="${oy + panelH / 2}" text-anchor="middle" ${FONT} font-size="10.5" fill="${COLORS.secondaryInk}" transform="rotate(-90 ${ox + 14} ${oy + panelH / 2})">ms</text>`;

    data.forEach((d, i) => {
      const gx = plotLeft + i * groupW + groupW / 2;
      // labelLift escalona o rótulo da 2ª série um pouco mais alto que o da 1ª —
      // evita colisão de texto quando as duas barras do grupo são curtas e
      // próximas (ex.: p50 do C4, onde os dois intervalos min–max ficam perto
      // do eixo e um do outro).
      const drawBar = (entry, dx, fill, labelLift) => {
        if (!entry) return;
        const val = entry.v ?? entry.max;
        const h = (val / yMax) * plotHeight;
        const x = gx + dx - barW / 2;
        const y = plotBottom - h;
        s += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${fill}"/>`;
        if (entry.min !== undefined) {
          const yMin = plotBottom - (entry.min / yMax) * plotHeight;
          const cx = x + barW / 2;
          s += `<line x1="${cx}" y1="${y}" x2="${cx}" y2="${yMin}" stroke="${COLORS.ink}" stroke-width="1.3"/>`;
          s += `<line x1="${cx - 5}" y1="${yMin}" x2="${cx + 5}" y2="${yMin}" stroke="${COLORS.ink}" stroke-width="1.3"/>`;
          s += `<text x="${cx}" y="${y - labelLift}" text-anchor="middle" ${FONT} font-size="9" fill="${COLORS.ink}">${num(entry.min,2)}–${num(entry.max,2)}</text>`;
        } else {
          s += `<text x="${x + barW / 2}" y="${y - labelLift}" text-anchor="middle" ${FONT} font-size="9.5" fill="${COLORS.ink}">${num(entry.v,2)}</text>`;
        }
      };
      drawBar(d.p2p, -barW / 2 - 5, COLORS.p2p, 6);
      drawBar(d.pubsub, barW / 2 + 5, 'url(#hatch-pubsub)', 20);
      s += `<text x="${gx}" y="${plotBottom + 18}" text-anchor="middle" ${FONT} font-size="11.5" fill="${COLORS.ink}">${d.label}</text>`;
    });
    return s;
  }

  let svg = defs();
  svg += `<text x="${width / 2}" y="26" text-anchor="middle" ${FONT} font-size="19" font-weight="700" fill="${COLORS.ink}">Latência de entrega por cenário e modelo</text>`;
  svg += panel(10, 50, DATA.p50, 'p50');
  svg += panel(10 + (panelW + gap), 50, DATA.p95, 'p95');
  svg += panel(10 + 2 * (panelW + gap), 50, DATA.p99, 'p99');

  const legY = height - 26;
  svg += `<rect x="${width/2 - 150}" y="${legY}" width="16" height="16" fill="${COLORS.p2p}"/>`;
  svg += `<text x="${width/2 - 128}" y="${legY + 13}" ${FONT} font-size="13" fill="${COLORS.ink}">P2P</text>`;
  svg += `<rect x="${width/2 + 10}" y="${legY}" width="16" height="16" fill="url(#hatch-pubsub)"/>`;
  svg += `<text x="${width/2 + 32}" y="${legY + 13}" ${FONT} font-size="13" fill="${COLORS.ink}">Pub/Sub</text>`;

  return wrapHtml('Latência p50/p95/p99', svg, width, height);
}

// ---------------------------------------------------------------------------
// Gráfico 3 — Confiabilidade sob falha de consumidor (C5): barras empilhadas
// por modelo, separando recebidas (bom) de perdidas (crítico). O redelivered
// do P2P é anotado textualmente — não é um segmento de perda.
// ---------------------------------------------------------------------------
function chart3() {
  const width = 760, height = 560;
  const plotLeft = 140, plotRight = width - 60, plotTop = 70, plotBottom = height - 150;
  const plotHeight = plotBottom - plotTop;
  const total = 4500;
  const barW = 160;
  const xP2P = plotLeft + 110;
  const xPubSub = plotRight - 110;

  const p2p = { recebidas: 4500, perdidas: 0, redelivered: 1 };
  const pubsub = { recebidas: 3540, perdidas: 960 };
  const perdaPct = (pubsub.perdidas / total * 100);

  let svg = defs();
  svg += `<text x="${width / 2}" y="30" text-anchor="middle" ${FONT} font-size="19" font-weight="700" fill="${COLORS.ink}">Confiabilidade sob falha de consumidor — C5</text>`;
  svg += `<text x="${width / 2}" y="52" text-anchor="middle" ${FONT} font-size="12.5" fill="${COLORS.secondaryInk}">4500 mensagens publicadas em cada modelo — janela de falha simulada: 30s–50s</text>`;

  // eixo Y (mensagens)
  for (let t = 0; t <= total; t += 900) {
    const y = plotBottom - (t / total) * plotHeight;
    svg += `<line x1="${plotLeft - 90}" y1="${y}" x2="${plotRight + 90}" y2="${y}" stroke="${COLORS.grid}" stroke-width="1"/>`;
    svg += `<text x="${plotLeft - 14}" y="${y + 4}" text-anchor="end" ${FONT} font-size="11" fill="${COLORS.mutedInk}">${t}</text>`;
  }
  svg += `<text x="16" y="${plotTop + plotHeight / 2}" text-anchor="middle" ${FONT} font-size="12" fill="${COLORS.secondaryInk}" transform="rotate(-90 16 ${plotTop + plotHeight / 2})">mensagens</text>`;

  function stackedBar(cx, recebidas, perdidas, fillRecebidas, hatchPerdidas) {
    const hRec = (recebidas / total) * plotHeight;
    const hPerd = (perdidas / total) * plotHeight;
    const x = cx - barW / 2;
    const yRecTop = plotBottom - hRec;
    let s = '';
    if (perdidas > 0) {
      const yPerdTop = yRecTop - hPerd;
      s += `<rect x="${x}" y="${yPerdTop}" width="${barW}" height="${hPerd}" fill="${hatchPerdidas}"/>`;
      s += `<text x="${cx}" y="${yPerdTop - 10}" text-anchor="middle" ${FONT} font-size="13" font-weight="600" fill="${COLORS.critical}">${perdidas} perdidas (${num(perdaPct,1)}%)</text>`;
    }
    s += `<rect x="${x}" y="${yRecTop}" width="${barW}" height="${hRec}" fill="${fillRecebidas}"/>`;
    s += `<text x="${cx}" y="${yRecTop + hRec / 2 + 5}" text-anchor="middle" ${FONT} font-size="14" font-weight="600" fill="#ffffff">${recebidas} recebidas</text>`;
    return s;
  }

  svg += stackedBar(xP2P, p2p.recebidas, p2p.perdidas, COLORS.good, 'url(#hatch-critical)');
  svg += stackedBar(xPubSub, pubsub.recebidas, pubsub.perdidas, COLORS.good, 'url(#hatch-critical)');

  svg += `<line x1="${plotLeft - 90}" y1="${plotBottom}" x2="${plotRight + 90}" y2="${plotBottom}" stroke="${COLORS.axis}" stroke-width="1.5"/>`;
  svg += `<text x="${xP2P}" y="${plotBottom + 24}" text-anchor="middle" ${FONT} font-size="15" font-weight="700" fill="${COLORS.ink}">P2P</text>`;
  svg += `<text x="${xPubSub}" y="${plotBottom + 24}" text-anchor="middle" ${FONT} font-size="15" font-weight="700" fill="${COLORS.ink}">Pub/Sub</text>`;

  // anotação do redelivered no P2P (não é perda)
  svg += `<text x="${xP2P}" y="${plotBottom + 48}" text-anchor="middle" ${FONT} font-size="11" fill="${COLORS.secondaryInk}">* 1 mensagem reentregue via XAUTOCLAIM</text>`;
  svg += `<text x="${xP2P}" y="${plotBottom + 64}" text-anchor="middle" ${FONT} font-size="11" fill="${COLORS.secondaryInk}">(incluída nas recebidas — não é perda)</text>`;

  // legenda
  const legY = height - 34;
  svg += `<rect x="${width/2 - 160}" y="${legY}" width="16" height="16" fill="${COLORS.good}"/>`;
  svg += `<text x="${width/2 - 138}" y="${legY + 13}" ${FONT} font-size="13" fill="${COLORS.ink}">Recebidas</text>`;
  svg += `<rect x="${width/2 + 10}" y="${legY}" width="16" height="16" fill="url(#hatch-critical)"/>`;
  svg += `<text x="${width/2 + 32}" y="${legY + 13}" ${FONT} font-size="13" fill="${COLORS.ink}">Perdidas</text>`;

  return wrapHtml('Confiabilidade C5', svg, width, height);
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const jobs = [
    { name: 'throughput-efetivo', build: chart1, w: 1100, h: 560 },
    { name: 'latencia-p50-p95-p99', build: chart2, w: 1500, h: 480 },
    { name: 'confiabilidade-c5', build: chart3, w: 760, h: 560 },
  ];

  for (const job of jobs) {
    const html = job.build();
    const outPath = `${OUT_DIR}/${job.name}.png`;
    renderToPng(`${job.name}.html`, html, outPath, job.w, job.h);
    console.log(`[generate-result-charts] gerado: ${outPath}`);
  }

  try { rmdirSync(TMP_DIR); } catch { /* diretório não-vazio ou já removido — sem problema */ }
  console.log('[generate-result-charts] concluído.');
}

main();
