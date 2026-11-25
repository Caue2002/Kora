# Spec: Indicador de carregamento metaball padrao — V1

Status: aprovado

## Objetivo

Padronizar TODOS os indicadores de espera/processamento do app em um unico
efeito visual: 3 gotas em metaball (blur + contrast) dentro de uma pilula
sutil. Qualquer UI nova que mostre loading DEVE reutilizar o padrao —
sem spinners, pontinhos ou textos soltos de "carregando".

## Decisoes

- Efeito metaball em CSS puro (sem libs): `filter: blur(5px)` na camada das
  gotas + `filter: contrast(20)` no container do palco. As gotas escuras
  (`--usuario`) sobre fundo claro (`--cartao`) se fundem como liquido
  quando se aproximam — sem serrilhar bordas.
- Animacao continua em loop: `@keyframes gota-metaball`
  (esquerda -> centro -> direita -> centro -> esquerda), `ease-in-out`,
  `animation-delay` negativo escalonado e duracoes levemente diferentes
  por gota para movimento organico.
- Componente React unico `IndicadorCarregando` em `frontend/src/App.tsx`,
  com prop `grande` para telas de transicao. Tamanhos via custom
  properties (`--gota-tam`, `--curso`, `--palco-w`, `--palco-h`) para
  variantes sem duplicar keyframes.
- Acessibilidade: `role="status"` + `aria-label="Carregando"` no elemento
  externo; camadas internas `aria-hidden`.
- Paginas estaticas fora do bundle React (ex.: `frontend/public/metricas.html`)
  replicam o mesmo principio com CSS proprio e cores invertidas para o
  tema escuro (gotas claras sobre palco escuro).
- CSS morto de indicadores antigos (`.msg-digitando`, `.dot`, `pulsa`,
  `.msg-digitando-inline`, `.encerrando-spinner`) removido na mesma mudanca.

## Pontos de aplicacao (mapa)

| Onde | Antes | Depois |
| --- | --- | --- |
| Bolha de resposta do chat (streaming) | 4 bolinhas orbitais | `IndicadorCarregando` padrao |
| Modal de handoff ("Gerando resumo do caso...") | so texto italico | indicador + texto |
| Tela "Encerrando..." | spinner circular (`border`+`rotate`) | `IndicadorCarregando grande` |
| Painel `/metricas.html` ("carregando…") | so texto | metaball escuro durante fetch |

## Fora de escopo (V2)

- Indicador dentro do botao Enviar durante `enviando` (a bolha ja mostra).
- Skeleton screens para listas/historico.
