# Spec: Indicador de carregamento orbita padrao — V2

Status: aprovado (substitui o metaball da V1)

## Objetivo

Padronizar TODOS os indicadores de espera/processamento do app em um unico
efeito visual: 3 esferas girando entre si em circulo, SEM pilula/borda e
SEM bolha de mensagem ao redor — apenas as bolinhas — com luz azul:
uma luz suave que percorre a orbita (`.msg-orbita-luz`), um brilho
azul em cada esfera (box-shadow) e um feixe de luz azul em cada uma
(`::after` tangente ao movimento, pulsando via `feixe-onda`). Qualquer
UI nova que mostre
loading DEVE reutilizar o padrao — sem spinners, pontinhos ou textos
soltos de "carregando".

## Decisoes

- Movimento circular continuo em loop com `cubic-bezier(0.45, 0, 0.55, 1)`:
  `@keyframes orbita-agente` amostra a circunferencia a cada 45 graus com
  `translate` (raio via custom property `--orbita-r`, entao variantes nao
  duplicam keyframes) + `scale`/`opacity` para profundidade — esferas
  "na frente" maiores e mais nitidas, "atras" menores e translucidas
  — + `rotate` final alinhando o feixe `::after` a tangente.
- Luz azul de acompanhamento: `.msg-orbita-luz`, radial-gradient azul
  desfocado que percorre a mesma orbita com delay proprio (-0.666s).
- Brilho e feixes azuis por esfera: `box-shadow` azul em
  `.msg-orbita-ponto` e `::after` — linha em gradiente alinhada a
  tangente do movimento (o `rotate` do keyframes gira 45 graus por
  passo), pulsando com `@keyframes feixe-onda` (scaleX + opacity,
  delays defasados). Os feixes se cruzam perto do centro da orbita.
- `animation-delay` negativo escalonado nos pontos (1/3 e 2/3 do ciclo =
  120/240 graus de defasagem entre as 3 esferas). A luz ocupa o primeiro
  filho do palco; os pontos sao os filhos 2, 3 e 4.
- Movimento extra circular (acrescimo pos-V2): `.msg-orbita-anel`, anel
  tracejado que gira continuamente em `linear` atras das esferas, e duas
  `.msg-orbita-onda`, ondas que nascem no centro e expandem alem da orbita
  com `ease-out` (delays defasados pela metade do ciclo). Ambos ficam
  atras das bolinhas via `z-index: -1`, contidos pelo stacking context do
  `.msg-orbita-palco` (`z-index: 0`).
- No chat, o indicador aparece SOLTO no corpo da mensagem do assistente
  (`.msg-status-solto`), sem `.msg-balao` ao redor — a bolha so aparece
  quando ha conteudo.
- Indicador SEM container: `.msg-orbita` e apenas um `inline-flex` de
  apoio; o tamanho visual vem do `.msg-orbita-palco` quadrado (22x22
  padrao, 28x28 na variante `grande`). Esferas de 6px (7px na variante),
  raio da orbita 8px (10px na variante).
- Componente React unico `IndicadorCarregando` em `frontend/src/App.tsx`,
  com prop `grande`. Tamanhos via custom properties (`--orbita-tam`,
  `--orbita-r`) para variantes sem duplicar keyframes.
- Acessibilidade: `role="status"` + `aria-label="Carregando"` no elemento
  externo; camadas internas `aria-hidden`.
- Paginas estaticas fora do bundle React (ex.: `frontend/public/metricas.html`)
  replicam o mesmo principio com classes proprias (`orbita`, `orbita-palco`,
  `orbita-ponto`, `orbita-luz`) e cores invertidas para o tema escuro
  (esferas e luz claras).

## Pontos de aplicacao (mapa)

| Onde | Antes | Depois |
| --- | --- | --- |
| Bolha de resposta do chat (streaming) | 4 bolinhas orbitais | `IndicadorCarregando` solto, sem `.msg-balao` |
| Modal de handoff ("Gerando resumo do caso...") | so texto italico | indicador + texto |
| Tela "Encerrando..." | spinner circular (`border`+`rotate`) | `IndicadorCarregando grande` |
| Painel `/metricas.html` ("carregando…") | so texto | orbita escura durante fetch |

## Fora de escopo (V2 backlog)

- Indicador dentro do botao Enviar durante `enviando` (a bolha ja mostra).
- Skeleton screens para listas/historico.

## Historico

- V1 (metaball): pilula 56x26 com 3 gotas fundidas por `blur(5px)` +
  `contrast(20)`, movimento linear esquerda-direita. V2: orbita eliptica
  em pilula. Estado atual: circulo de esferas com luz de acompanhamento,
  sem pilula e sem bolha de chat ao redor do indicador.
- Acrescimo: anel tracejado girando (`anel-orbita`) + ondas expansivas
  (`onda-orbita`) em volta da orbita, mantendo tudo em circulo.
