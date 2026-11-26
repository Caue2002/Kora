# Spec: Roteamento de Modelos por Intencao — V1

Status: implementado — verificado ao vivo (casual/meta -> gemini-3.5-flash-lite)

Modulo `roteamento-modelos` do capability-map (`spec/capability-map.md`).

## Objetivo

Hoje `selecionarModelo` sempre comeca a fila pelo modelo MAIS FORTE com
folga de cota — inclusive para "obrigado", "oi, tudo bem?" e perguntas
meta sobre a propria Nori. Isso gasta o modelo principal (e a cota dele)
em mensagens que um modelo lite resolve igual.

Roteamento por intencao: mensagens casuais/meta (`semContextoRAG`, mesmo
criterio que ja pula RAG e function calling) comecam a fila nos modelos
lite; mensagens de triagem de disputa continuam comecando no mais forte.
Otimizacao de custo/latencia visivel no badge de modelo de cada resposta.

## Decisoes

- `selecionarModelo(tokens, prioridadeMinima = 1)` em shared/models.ts:
  novo parametro opcional filtra o catalogo por `prioridade >= minima`
  (numero maior = modelo mais fraco/leve). Default preserva o
  comportamento atual para todos os outros chamadores.
- api/chat.ts calcula a prioridade minima da classe "leve" como a menor
  prioridade de modelo com 'lite' no nomeModelo do catalogo (hoje = 7,
  gemini-3.5-flash-lite) — derivado do catalogo, nao hardcoded, para
  acompanhar mudancas de env.
- `classeLeve = semContextoRAG` (mensagem casual ou pergunta meta, sem
  imagem/pedido/codigo). Triagem, follow-ups com contexto, imagem e
  codigo de pedido seguem na classe forte.
- O fallback "nenhum modelo com folga" em /api/chat respeita a mesma
  prioridade minima (antes sempre pegava o mais forte do catalogo).
- Filas de failover ja usam `prioridade >= modeloInicial.prioridade`:
  mensagem leve que esgotar os lites continua descendo para os slots
  mais fracos (3.7-flash, flash-latest, pollinations) — nunca sobe para
  os modelos fortes. Se tudo falhar, cai nas camadas de fallback
  existentes (inalterado).
- /api/parecer, /api/caso, /api/handoff e /api/mcp NAO mudam: sempre
  classe forte.

## Fora de escopo (V2)

- Roteamento por score de retrieval ou por tamanho estimado de resposta
- Custo por mensagem registrado por classe (metricas_chat nao tem coluna
  de intencao; o modelo usado ja e registrado e evidencia o roteamento)
- Ajuste de temperatura/maxTokens por classe

## Boundaries

- Always: typecheck + testes + build antes de commitar; docs
  (CONTEXTO_ATUAL, fluxo-kora, Guia PDF) no mesmo ciclo.
- Ask first: mudanca no catalogo de modelos (shared/env.ts).
- Never: alterar a ordem de prioridade do catalogo; fazer mensagem de
  triagem cair em modelo lite por engano (a classe forte e o default).

## Criterios de sucesso

- Mensagem casual/meta usa modelo lite quando ha folga (badge x-modelo
  mostra o lite); triagem usa o mais forte disponivel.
- Esgotamento de cotas continua funcionando nas duas classes.
- Testes unitarios cobrindo a filtragem por prioridade minima.
