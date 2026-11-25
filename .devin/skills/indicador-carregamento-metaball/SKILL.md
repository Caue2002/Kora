---
name: indicador-carregamento-metaball
description: Padrao obrigatorio de indicador de carregamento do Projeto Kora. Use SEMPRE que for criar ou alterar qualquer UI que mostre espera/processamento (spinners, "carregando...", dots animados, estados de botao com loading). Define o componente IndicadorCarregando, as classes CSS de orbita, variantes e onde o padrao ja esta aplicado. (Nome da skill mantido por compatibilidade; o efeito atual e a orbita eliptica, ex-metaball.)
---

# Indicador de Carregamento Orbita (Kora)

## Regra principal

Todo indicador de carregamento/espera do app DEVE usar o efeito de orbita
padrao: 3 esferas em orbita eliptica, SEM pilula/borda ao redor — apenas
as bolinhas. NUNCA criar spinners CSS (`border` + `rotate`), pontinhos
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
    <span className="msg-orbita-ponto" /> x3
  </span>
</span>
```

## Como funciona (CSS em frontend/src/styles.css)

- `.msg-orbita` — wrapper `inline-flex` SEM fundo/borda (o indicador e so
  as bolinhas). Define variaveis de tamanho: `--orbita-tam`,
  `--orbita-rx`, `--orbita-ry`.
- `.msg-orbita-palco` — container da orbita (26x16 no padrao, 32x20 na
  variante `grande`). Nao tem fundo nem borda.
- `.msg-orbita-ponto` — 3 esferas `var(--usuario)` animadas por
  `@keyframes orbita-agente`: elipse amostrada a cada 45 graus via
  `translate` (raios vem das custom properties, entao variantes nao
  duplicam keyframes) + `scale`/`opacity` para profundidade — frente
  maior/mais nitida, tras menor/translucida. `cubic-bezier(0.45,0,0.55,1)`,
  duracao 4s, delays negativos -1.333s/-2.667s (defasagem de 120/240
  graus).
- `.msg-orbita-grande` — variante para telas de transicao
  (ex.: "Encerrando..."): so muda as variaveis de tamanho e o palco.

## Ajustes

- Velocidade: `animation-duration` em `.msg-orbita-ponto`.
- Tamanho/forma: variaveis `--orbita-tam`/`--orbita-rx`/`--orbita-ry` na
  classe `.msg-orbita` (ou nova variante) + width/height de
  `.msg-orbita-palco`. Manter so as bolinhas, sem container visivel.
- Intensidade da profundidade: `scale`/`opacity` dentro de
  `@keyframes orbita-agente`.

## Fora do React (HTML estatico)

Paginas estaticas (ex.: `frontend/public/metricas.html`, tema escuro)
replicam o mesmo principio com classes proprias (`orbita`, `orbita-palco`,
`orbita-ponto`) e cores invertidas: esferas CLARAS sobre o tema escuro.
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
