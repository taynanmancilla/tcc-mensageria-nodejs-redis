# Análise Comparativa dos Resultados

> **Status: rascunho inicial.** Este documento é um ponto de partida para a seção de Discussão/Análise da monografia, não uma versão final formatada em ABNT. Todos os números citados vêm de [`docs/resultados-consolidados.md`](resultados-consolidados.md) — nenhum valor novo foi calculado ou estimado aqui.

## 1. Objetivo da Análise

Esta análise compara os modelos **Point-to-Point (P2P)**, implementado sobre Redis Streams, e **Publish/Subscribe (Pub/Sub)**, implementado sobre Redis Pub/Sub nativo, ao longo dos cinco cenários experimentais (C1–C5), considerando quatro dimensões: throughput, latência, confiabilidade e comportamento sob falha. O objetivo é discutir o que os dados já consolidados permitem concluir — e deixar explícito o que eles não permitem concluir — sobre as diferenças práticas entre os dois modelos nas condições testadas.

## 2. Visão Geral dos Resultados

Em todos os cenários sem falha simulada (C1, C2, C3 e C4), ambos os modelos entregaram o volume de mensagens esperado, sem perda real: C1 fechou 600/600 em ambos os modelos, C2 fechou 3000/3000 no P2P, C3 fechou 3000 publicadas com 3000/3000 recebidas por cada um dos 4 subscribers (o total agregado de 12000 reflete o fan-out, não uma discrepância — não é comparável diretamente a `sent`), e C4 fechou 120000/120000 em ambos os modelos. A diferença de comportamento entre os dois modelos só se torna visível em duas dimensões: **sob alta carga** (C4, onde throughput e latência divergem) e **sob falha de consumidor** (C5, onde a diferença deixa de ser de desempenho e passa a ser de garantia de entrega). C5 é, dos cinco cenários, o que evidencia a diferença qualitativa mais relevante entre os dois modelos.

## 3. Análise de Throughput

Com base na seção 4 do consolidado (throughput real = enviadas ÷ tempo observado):

- **C1** ficou próximo da taxa nominal de 10 msg/s em ambos os modelos (≈9,9 msg/s).
- **C2, C3 e C5** ficaram próximos da faixa nominal de 50 msg/s, com pequena diferença atribuível ao overhead de execução já documentado (C2: ≈45,8–47,1 msg/s; C3: ≈46,8–47,9 msg/s; C5: ≈48,0 msg/s no P2P e ≈47,9 msg/s no Pub/Sub).
- **C4** mostrou a maior diferença entre os modelos: P2P sustentou aproximadamente **979–1187 msg/s**, enquanto Pub/Sub sustentou aproximadamente **843–927 msg/s** — uma faixa consistentemente mais baixa.

Essa diferença no C4 deve ser interpretada com cautela: o throughput real foi derivado de `enviadas ÷ tempo observado`, e o próprio tempo observado variou entre execuções (daí o C4 ser reportado como intervalo, não valor único). Não é possível, com os dados disponíveis, afirmar que o Pub/Sub é *sempre* mais lento sob alta carga — apenas que, **nas execuções realizadas neste experimento**, ele sustentou uma taxa efetiva menor que o P2P sob a mesma taxa nominal. Generalizar esse resultado para além dos cenários e do ambiente testados (processo único, mesma máquina, Redis local) não é suportado pelos dados.

## 4. Análise de Latência

Com base na seção 5 do consolidado:

- Em **C1, C2, C3 e C5**, os percentis de latência dos dois modelos ficaram próximos entre si e na mesma ordem de grandeza — majoritariamente entre ~2ms (p50) e ~5ms (p95/p99).
- Em **C4**, a divergência é clara: P2P apresentou p95 entre **0,963–0,974ms** e p99 entre **1,928–3,400ms**, enquanto Pub/Sub apresentou p95 entre **2,790–3,429ms** e p99 entre **4,566–4,692ms**. Sob alta carga, portanto, o Pub/Sub apresentou percentis altos (p95/p99) consistentemente mais elevados que o P2P.
- Um ponto que chama atenção: o **p50 de ambos os modelos é menor no C4** (≈0,51ms P2P, ≈0,55–0,57ms Pub/Sub) do que nos demais cenários de baixa/média carga (≈2,1–3,0ms). Esse é um resultado observado, não uma conclusão geral — ele pode refletir características do padrão de execução e do momento específico em que a coleta foi feita (ver limitações na seção 7 do consolidado), e não necessariamente uma relação causal de "mais carga reduz a latência mediana". Nenhuma explicação adicional é proposta aqui além do que os dados mostram.

Não se afirma, portanto, que a alta carga "melhora" a latência de forma absoluta — apenas que o p50 observado foi menor nessas execuções específicas, enquanto os percentis de cauda (p95/p99) se comportaram de forma esperada: mais altos sob mais carga, e mais altos no Pub/Sub que no P2P nessa condição.

## 5. Análise de Confiabilidade

Com base na seção 3 do consolidado, especialmente o cenário C5:

- **P2P:** 4500 enviadas, 4500 recebidas, perda 0%, 1 mensagem reentregue via PEL/`XAUTOCLAIM`.
- **Pub/Sub:** 4500 enviadas, 3540 recebidas, 960 perdidas, perda 21,3%.

Essa é a diferença mais importante observada no experimento. O Redis Streams (P2P) persiste mensagens não confirmadas no PEL (Pending Entries List) e permite reentrega — o que, no cenário testado, foi suficiente para não perder nenhuma mensagem apesar da falha simulada de um worker. O Redis Pub/Sub entrega em tempo real, mas **não preserva mensagens para um subscriber desconectado**: tudo que foi publicado durante a janela de falha (30s–50s) foi perdido de forma permanente para aquele subscriber, sem possibilidade de recuperação posterior.

## 6. Comparação por Cenário

### C1 — Baseline

Em condição simples (rate baixo, 1 producer, 1 consumer, sem falha), os dois modelos se comportaram de forma equivalente: mesmo volume entregue (600/600), perda 0% e percentis de latência muito próximos entre si (p50 ≈2,96ms P2P vs. ≈2,94ms Pub/Sub). Nenhuma diferença relevante entre os modelos é observável nesta condição.

### C2 — Fila de Tarefas

Cenário exclusivo do P2P, com 4 workers competindo pelo mesmo stream via consumer group. O resultado (3000/3000, distribuição 750×4 entre os workers) confirma o balanceamento de carga observado nessa configuração. Como todas as mensagens foram confirmadas, não houve perda no cenário executado; o experimento, porém, não busca demonstrar garantia formal de entrega exatamente uma vez.

### C3 — Disseminação de Eventos

Cenário exclusivo do Pub/Sub, com 4 subscribers simultâneos no mesmo canal (fan-out). O total agregado de recebidas (12000) é **maior que o total enviado (3000)** porque cada subscriber recebe a cópia completa de cada mensagem publicada — isso não é uma anomalia nem uma forma de "ganho" de mensagens, é o comportamento esperado do fan-out. Por isso, `received` agregado não é comparável diretamente a `sent` nesse cenário; a métrica relevante de fidelidade é a entrega por subscriber individualmente (3000/3000 em cada um dos 4), que se confirmou completa.

### C4 — Alta Carga

Sob taxa nominal agregada de 1000 msg/s, com múltiplos producers/publishers, o P2P sustentou throughput efetivo mais alto (≈979–1187 msg/s) que o Pub/Sub (≈843–927 msg/s), e exibiu percentis de cauda (p95/p99) mais baixos. Ambos os modelos, porém, entregaram a totalidade das mensagens (120000/120000), sem perda real em nenhum dos dois — a diferença aqui é de desempenho, não de confiabilidade.

### C5 — Falha de Consumidor

O cenário com a falha simulada (interrupção de um worker/subscriber entre 30s e 50s) é o que separa os dois modelos de forma mais nítida. O P2P absorveu a falha sem perda real (0%), com uma única mensagem precisando de reentrega via `XAUTOCLAIM`. O Pub/Sub perdeu permanentemente 21,3% do volume publicado durante a janela de desconexão — uma perda estrutural do modelo, não um defeito de implementação.

## 7. Verificação da Hipótese

Como hipótese operacional para esta análise, formula-se:

> "Espera-se que o modelo P2P apresente maior confiabilidade em cenários com falha, enquanto o Pub/Sub apresente comportamento adequado para disseminação em tempo real, mas sem garantia de entrega para consumidores desconectados."

Com base nos resultados obtidos, **essa hipótese foi confirmada**, sustentada principalmente pelos cenários C3 e C5: o C3 demonstrou que o Pub/Sub cumpre bem seu papel de disseminação em tempo real para múltiplos assinantes simultâneos (fan-out fiel, 3000/3000 por subscriber), e o C5 demonstrou diretamente a ausência de garantia de entrega do Pub/Sub diante de desconexão (21,3% de perda), em contraste com a recuperação completa do P2P (0% de perda, reentrega via PEL/`XAUTOCLAIM`). Essa confirmação deve ser lida com as ressalvas de escopo e ambiente detalhadas na seção 8 — os resultados são específicos aos cenários, parâmetros e ambiente de execução deste experimento, não uma generalização universal sobre os dois modelos.

## 8. Limitações da Análise

- Os percentis de latência foram coletados em uma **bateria automatizada única** para C1, C2, C3 e C5, e em **duas execuções** para C4 — não há repetições estatísticas amplas com média/desvio padrão que permitam quantificar a incerteza de cada valor com rigor estatístico.
- Métricas de **CPU/memória** estão fora do escopo final deste TCC (decisão de escopo documentada, não uma lacuna de coleta).
- A métrica `tcc_queue_depth` está implementada no código, mas **não foi exercitada** em nenhum cenário — não há dado de profundidade de fila para discutir.
- Todos os experimentos foram executados em **ambiente local e controlado** (um único processo Node.js, Redis em container Docker na mesma máquina) — efeitos de rede real, múltiplas máquinas ou latência de rede distribuída não foram testados.
- Os resultados **não devem ser generalizados** para sistemas distribuídos em geral, outras implementações de Redis Streams/Pub-Sub, outras linguagens/runtimes, ou volumes/taxas fora da faixa testada (10–1000 msg/s agregados, 600–120000 mensagens por execução).

## 9. Conclusão da Análise

Os resultados consolidados sugerem que **P2P/Redis Streams é mais adequado quando confiabilidade, persistência e reentrega são requisitos centrais** — o cenário C5 demonstrou isso de forma direta, com recuperação completa diante de falha de consumidor. Por outro lado, **Pub/Sub/Redis Pub/Sub se mostrou adequado para disseminação em tempo real quando a perda de mensagens durante desconexões é aceitável** — o cenário C3 confirmou a fidelidade de entrega em fan-out para múltiplos assinantes ativos, mas o C5 confirmou que essa entrega não é garantida na ausência do assinante.

De forma geral, os dados deste experimento indicam que **a escolha entre os dois modelos depende mais dos requisitos de entrega e confiabilidade da aplicação do que apenas da latência média observada** — em condições normais (C1, C2, C3, C5 sem falha), os dois modelos se comportaram de forma muito semelhante em latência; a diferença decisiva apareceu sob falha (C5) e, secundariamente, sob alta carga (C4).
