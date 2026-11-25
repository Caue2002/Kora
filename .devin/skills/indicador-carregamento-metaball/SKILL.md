---
name: indicador-carregamento-metaball
description: Padrao obrigatorio de indicador de carregamento do Projeto Kora. Use SEMPRE que for criar ou alterar qualquer UI que mostre espera/processamento (spinners, "carregando...", dots animados, estados de botao com loading). Define o componente IndicadorCarregando, as classes CSS de orbita, variantes e onde o padrao ja esta aplicado. (Nome da skill mantido por compatibilidade; o efeito atual e a orbita eliptica, ex-metaball.)
---

# Indicador de Carregamento Orbita (Kora)

## Regra principal

Todo indicador de carregamento/espera do app DEVE usar o efeito de orbita
padrao: 3 esferas girando entre si em circulo, SEM pilula/borda e SEM
bolha de mensagem ao redor — apenas as bolinhas — com luz azul: uma luz
suave na orbita (`.msg-orbita-luz`), brilho azul em cada esfera
(box-shadow) e um feixe de luz azul por esfera (`::after` tangente ao
movimento, pulsando via `feixe-onda`). NUNCA criar spinners CSS
(`border` + `rotate`), pontinhos
pulsando (`pulsa`), barras ou textos "carregando..." sem o indicador.

Spec de referencia: `spec/SPEC-indicador-carregamento.md`.

## Implementacao no chat (React)

Componente: `IndicadorCarregando` em `frontend/src/App.tsx`.

```tsx
<IndicadorCarregando />        {/* orbita padrao */}
<IndicadorCarregando grande /> {/* variante p/ telas de transicao */}
```

Marcacao gerada (nao reescrever na mao):

```tsx
<span className="msg-orbita" role="status" aria-label="Carregando">
  <span className="msg-orbita-palco" aria-hidden="true">
    <span className="msg-orbita-luz" />
    <span className="msg-orbita-ponto" /> x3
    <span className="msg-orbita-anel" />
    <span className="msg-orbita-onda" />
    <span className="msg-orbita-onda msg-orbita-onda-2" />
  </span>
</span>
```

ATENCAO a ordem: anel e ondas vem DEPOIS dos pontos para nao deslocar os
`nth-child` dos delays/`::after`. Tudo permanece em circulo.

No chat, o indicador fica SOLTO no corpo da mensagem do assistente
(`.msg-status-solto`), sem `.msg-balao` — a bolha so existe com conteudo.

## Como funciona (CSS em frontend/src/styles.css)

- `.msg-orbita` — wrapper `inline-flex` SEM fundo/borda (o indicador e so
  as bolinhas + a luz). Define variaveis de tamanho: `--orbita-tam`,
  `--orbita-r`.
- `.msg-orbita-palco` — container quadrado da orbita (22x22 padrao,
  28x28 na variante `grande`). Nao tem fundo nem borda; `z-index: 0`
  cria stacking context para conter os filhos com `z-index: -1`.
- `.msg-orbita-luz` — luz azul de acompanhamento: radial-gradient azul
  desfocado que percorre a mesma orbita com `animation-delay: -0.666s`
  ("entre" as bolinhas). Ocupa o PRIMEIRO filho do palco.
- `.msg-orbita-ponto` — 3 esferas `var(--usuario)` com brilho azul
  (box-shadow) animadas por `@keyframes orbita-agente`: circulo
  amostrado a cada 45 graus via `translate` (raio vem de `--orbita-r`)
  + `scale`/`opacity` para profundidade + `rotate` final que alinha o
  feixe a tangente do movimento. `cubic-bezier(0.45,0,0.55,1)`, duracao
  4s, delays -1.333s/-2.667s nos filhos 3 e 4 do palco (a luz e o filho
  1; o primeiro ponto fica no filho 2 com delay 0).
- `.msg-orbita-ponto::after` — feixe de luz azul (gradiente + blur) que
  sai de cada bolinha na direcao do movimento; pulsa com
  `@keyframes feixe-onda` (scaleX/opacity, delays -0.6s/-1.2s nos
  filhos 3 e 4). Os feixes se cruzam perto do centro.
- `.msg-orbita-anel` — anel tracejado (`border: 1px dashed` azul) que
  gira continuamente em `linear` (8s) envolvendo a orbita
  (`@keyframes anel-orbita`, so `rotate`).
- `.msg-orbita-onda` (+ `.msg-orbita-onda-2`) — duas ondas circulares que
  nascem no centro e expandem alem da orbita (`@keyframes onda-orbita`,
  `scale` 0.55→1.7 + fade, 2.6s `ease-out`, segunda defasada -1.3s).
  Anel e ondas ficam atras das esferas via `z-index: -1`.
- `.msg-orbita-grande` — variante para telas de transicao
  (ex.: "Encerrando..."): so muda as variaveis de tamanho e o palco.

## Ajustes

- Velocidade: `animation-duration` em `.msg-orbita-ponto`,
  `.msg-orbita-luz`, `.msg-orbita-ponto::after`, `.msg-orbita-anel` e
  `.msg-orbita-onda`.
- Tamanho/forma: variaveis `--orbita-tam`/`--orbita-r` na classe
  `.msg-orbita` (ou nova variante) + width/height de `.msg-orbita-palco`.
  Manter so as bolinhas + luz + feixes, sem container visivel.
- Cores: azul atual e `rgba(37, 99, 235, ...)` no app claro e
  `rgba(59, 130, 246, ...)` no escuro — nas duas propriedades da luz,
  no box-shadow do ponto e no gradiente do ::after.
- Intensidade da profundidade: `scale`/`opacity` dentro de
  `@keyframes orbita-agente`.

## Fora do React (HTML estatico)

Paginas estaticas (ex.: `frontend/public/metricas.html`, tema escuro)
replicam o mesmo principio com classes proprias (`orbita`, `orbita-palco`,
`orbita-luz`, `orbita-ponto`) e cores invertidas: esferas e luz CLARAS
sobre o tema escuro.
Manter 3 esferas, orbita eliptica, `cubic-bezier` e delays escalonados —
so mudam cores e medidas.

## Acessibilidade

- Sempre `role="status"` + `aria-label="Carregando"` no elemento externo.
- Camadas internas com `aria-hidden="true"`.
- Nunca depender so da animacao para transmitir estado: manter texto de
  status ao lado quando fizer sentido ("Gerando resposta...", etc.).

## Onde ja esta aplicado

- Bolha de resposta do chat (`App.tsx`, streaming).
- Modal de handoff ("Gerando resumo do caso...").
- Tela "Encerrando..." (variante `grande`).
- Painel `/metricas.html` ("carregando…" durante fetch, versao escura).
