---
name: indicador-carregamento-metaball
description: Padrao obrigatorio de indicador de carregamento do Projeto Kora. Use SEMPRE que for criar ou alterar qualquer UI que mostre espera/processamento (spinners, "carregando...", dots animados, estados de botao com loading). Define o componente IndicadorCarregando, as classes CSS metaball, variantes e onde o padrao ja esta aplicado.
---

# Indicador de Carregamento Metaball (Kora)

## Regra principal

Todo indicador de carregamento/espera do app DEVE usar o efeito metaball
padrao. NUNCA criar spinners CSS (`border` + `rotate`), pontinhos
pulsando (`pulsa`), barras ou textos "carregando..." sem o indicador.

Spec de referencia: `spec/SPEC-indicador-carregamento.md`.

## Implementacao no chat (React)

Componente: `IndicadorCarregando` em `frontend/src/App.tsx`.

```tsx
<IndicadorCarregando />        {/* pilula padrao (56x26) */}
<IndicadorCarregando grande /> {/* variante grande p/ telas de transicao */}
```

Marcação gerada (nao reescrever na mao):

```tsx
<span className="msg-metaball" role="status" aria-label="Carregando">
  <span className="msg-metaball-palco" aria-hidden="true">
    <span className="msg-metaball-gotas">
      <span className="gota" /> x3
    </span>
  </span>
</span>
```

## Como funciona (CSS em frontend/src/styles.css)

- `.msg-metaball` — pilula externa (fundo `--acento-claro`, borda sutil).
  Define variaveis de tamanho: `--gota-tam`, `--curso`, `--palco-w`, `--palco-h`.
- `.msg-metaball-palco` — container com `filter: contrast(20)` (contraste).
- `.msg-metaball-gotas` — camada das gotas com `filter: blur(5px)` (blur).
  Blur na camada + contrast no container = efeito metaball (gotas que se
  fundem como liquido sem serrilhar bordas).
- `.gota` — 3 pontos `var(--usuario)` animados por `@keyframes gota-metaball`
  (esquerda -> centro -> direita -> centro -> esquerda, `ease-in-out`,
  delays negativos escalonados e duracoes levemente diferentes).
- `.msg-metaball-grande` — variante para telas de transicao
  (ex.: "Encerrando..."): so muda as variaveis de tamanho.

## Ajustes

- Velocidade: `animation-duration` em `.gota:nth-child(n)`.
- Tamanho: variaveis `--gota-tam`/`--curso`/`--palco-w`/`--palco-h` na classe
  `.msg-metaball` (ou nova variante).
- Fusao: `blur(5px)` em `.msg-metaball-gotas` e `contrast(20)` em
  `.msg-metaball-palco`.

## Fora do React (HTML estatico)

Paginas estaticas (ex.: `frontend/public/metricas.html`, tema escuro)
replicam o mesmo principio com classes proprias (`metaball`, `metaball-palco`,
`metaball-gotas`) e cores invertidas: gotas CLARAS sobre palco ESCURO.
Manter `filter: blur + contrast`, 3 gotas, `ease-in-out` e delays
escalonados — so mudam cores e medidas.

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
