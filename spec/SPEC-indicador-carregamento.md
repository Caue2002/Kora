# Spec: Indicador de carregamento orbita padrao — V2

Status: aprovado (substitui o metaball da V1)

## Objetivo

Padronizar TODOS os indicadores de espera/processamento do app em um unico
efeito visual: 3 esferas em orbita eliptica dentro de uma pilula sutil.
Qualquer UI nova que mostre loading DEVE reutilizar o padrao —
sem spinners, pontinhos ou textos soltos de "carregando".

## Decisoes

- Orbita eliptica em CSS puro (sem libs, sem `filter`): `@keyframes
  orbita-agente` amostra a elipse a cada 45 graus com `translate`
  (raios via custom properties `--orbita-rx`/`--orbita-ry`, entao variantes
  nao duplicam keyframes) + `scale`/`opacity` para profundidade — esferas
  "na frente" maiores e mais nitidas, "atras" menores e translucidas.
- Movimento continuo em loop com `cubic-bezier(0.45, 0, 0.55, 1)` e
  `animation-delay` negativo escalonado (1/3 e 2/3 do ciclo = 120/240
  graus de defasagem entre as 3 esferas).
- Pilula sempre PEQUENA: padrao 40x18px (`.msg-orbita`), variante
  `grande` 48x22px (`.msg-orbita-grande`) so para telas de transicao —
  ambas menores que a pilula metaball anterior (56x26 / 72x34).
- Componente React unico `IndicadorCarregando` em `frontend/src/App.tsx`,
  com prop `grande`. Tamanhos via custom properties (`--orbita-tam`,
  `--orbita-rx`, `--orbita-ry`) para variantes sem duplicar keyframes.
- Acessibilidade: `role="status"` + `aria-label="Carregando"` no elemento
  externo; camadas internas `aria-hidden`.
- Paginas estaticas fora do bundle React (ex.: `frontend/public/metricas.html`)
  replicam o mesmo principio com classes proprias (`orbita`, `orbita-palco`,
  `orbita-ponto`) e cores invertidas para o tema escuro (esferas claras
  sobre pilula escura).

## Pontos de aplicacao (mapa)

| Onde | Antes | Depois |
| --- | --- | --- |
| Bolha de resposta do chat (streaming) | 4 bolinhas orbitais | `IndicadorCarregando` (orbita) |
| Modal de handoff ("Gerando resumo do caso...") | so texto italico | indicador + texto |
| Tela "Encerrando..." | spinner circular (`border`+`rotate`) | `IndicadorCarregando grande` |
| Painel `/metricas.html` ("carregando…") | so texto | orbita escura durante fetch |

## Fora de escopo (V2 backlog)

- Indicador dentro do botao Enviar durante `enviando` (a bolha ja mostra).
- Skeleton screens para listas/historico.

## Historico

- V1 (metaball): pilula 56x26 com 3 gotas fundidas por `blur(5px)` +
  `contrast(20)`, movimento linear esquerda-direita. Substituida por
  decisao de design: a orbita eliptica com variacao de escala/opacidade
  le melhor e a pilula ficou menor.
