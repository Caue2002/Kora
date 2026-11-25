# Spec: Indicador de carregamento orbita padrao — V2

Status: aprovado (substitui o metaball da V1)

## Objetivo

Padronizar TODOS os indicadores de espera/processamento do app em um unico
efeito visual: 3 esferas em orbita eliptica, SEM pilula/borda ao redor —
apenas as bolinhas. Qualquer UI nova que mostre loading DEVE reutilizar
o padrao — sem spinners, pontinhos ou textos soltos de "carregando".

## Decisoes

- Orbita eliptica em CSS puro (sem libs, sem `filter`): `@keyframes
  orbita-agente` amostra a elipse a cada 45 graus com `translate`
  (raios via custom properties `--orbita-rx`/`--orbita-ry`, entao variantes
  nao duplicam keyframes) + `scale`/`opacity` para profundidade — esferas
  "na frente" maiores e mais nitidas, "atras" menores e translucidas.
- Movimento continuo em loop com `cubic-bezier(0.45, 0, 0.55, 1)` e
  `animation-delay` negativo escalonado (1/3 e 2/3 do ciclo = 120/240
  graus de defasagem entre as 3 esferas).
- Indicador SEM container: `.msg-orbita` e apenas um `inline-flex` de
  apoio; o tamanho visual vem do `.msg-orbita-palco` (26x16 padrao,
  32x20 na variante `grande`). Esferas de 6px (7px na variante).
- Componente React unico `IndicadorCarregando` em `frontend/src/App.tsx`,
  com prop `grande`. Tamanhos via custom properties (`--orbita-tam`,
  `--orbita-rx`, `--orbita-ry`) para variantes sem duplicar keyframes.
- Acessibilidade: `role="status"` + `aria-label="Carregando"` no elemento
  externo; camadas internas `aria-hidden`.
- Paginas estaticas fora do bundle React (ex.: `frontend/public/metricas.html`)
  replicam o mesmo principio com classes proprias (`orbita`, `orbita-palco`,
  `orbita-ponto`) e cores invertidas para o tema escuro (esferas claras).

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
  `contrast(20)`, movimento linear esquerda-direita. Substituida pela
  orbita eliptica, que depois perdeu a pilula por decisao de design —
  o indicador e so as bolinhas.
