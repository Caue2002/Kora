---
name: indicador-carregamento-metaball
description: Padrao obrigatorio de indicador de carregamento do Projeto Kora. Use SEMPRE que for criar ou alterar qualquer UI que mostre espera/processamento (spinners, "carregando...", dots animados, estados de botao com loading). Define o componente IndicadorCarregando, as classes CSS de orbita, variantes e onde o padrao ja esta aplicado. (Nome da skill mantido por compatibilidade; o efeito atual e a orbita eliptica, ex-metaball.)
---

# Indicador de Carregamento Orbita (Kora)

## Regra principal

Todo indicador de carregamento/espera do app DEVE usar o efeito de orbita
padrao: 3 esferas girando entre si em circulo, SEM pilula/borda e SEM
bolha de mensagem ao redor — apenas as bolinhas — mais uma luz suave que
percorre a mesma orbita. NUNCA criar spinners CSS (`border` + `rotate`),
pontinhos
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
  </span>
</span>
```

No chat, o indicador fica SOLTO no corpo da mensagem do assistente
(`.msg-status-solto`), sem `.msg-balao` — a bolha so existe com conteudo.

## Como funciona (CSS em frontend/src/styles.css)

- `.msg-orbita` — wrapper `inline-flex` SEM fundo/borda (o indicador e so
  as bolinhas + a luz). Define variaveis de tamanho: `--orbita-tam`,
  `--orbita-r`.
- `.msg-orbita-palco` — container quadrado da orbita (22x22 padrao,
  28x28 na variante `grande`). Nao tem fundo nem borda.
- `.msg-orbita-luz` — luz de acompanhamento: radial-gradient quente
  desfocado que percorre a mesma orbita com `animation-delay: -0.666s`
  ("entre" as bolinhas). Ocupa o PRIMEIRO filho do palco.
- `.msg-orbita-ponto` — 3 esferas `var(--usuario)` animadas por
  `@keyframes orbita-agente`: circulo amostrado a cada 45 graus via
  `translate` (raio vem de `--orbita-r`) + `scale`/`opacity` para
  profundidade — frente maior/mais nitida, tras menor/translucida.
  `cubic-bezier(0.45,0,0.55,1)`, duracao 4s, delays -1.333s/-2.667s nos
  filhos 3 e 4 do palco (a luz e o filho 1; o primeiro ponto fica no
  filho 2 com delay 0).
- `.msg-orbita-grande` — variante para telas de transicao
  (ex.: "Encerrando..."): so muda as variaveis de tamanho e o palco.

## Ajustes

- Velocidade: `animation-duration` em `.msg-orbita-ponto` e
  `.msg-orbita-luz`.
- Tamanho/forma: variaveis `--orbita-tam`/`--orbita-r` na classe
  `.msg-orbita` (ou nova variante) + width/height de `.msg-orbita-palco`.
  Manter so as bolinhas + luz, sem container visivel.
- Cor da luz: `background` radial-gradient de `.msg-orbita-luz`.
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
