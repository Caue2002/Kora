# Spec: Memoria Persistente do Usuario (anonima) — V1

Status: implementado

Modulo `memoria-usuario` do capability-map (`spec/capability-map.md`).
Decisao do usuario: SEM login — o dispositivo recebe um UUID anonimo
persistido em localStorage; auth multi-usuario e fase 2.

## Objetivo

Hoje a Nori esquece tudo quando a conversa/aba termina. Com a memoria, ela
lembra fatos de sessoes anteriores (preferencias, pedidos ja tratados,
pendencias) e personaliza a proxima conversa — o momento "uau" da demo.

## Decisoes

- **Identidade**: `dispositivoId` = UUID gerado no frontend
  (`crypto.randomUUID()`, localStorage `kora-device-id`). Vai no body de
  POST /api/chat e POST /api/memoria; validado por regex no servidor
  (mesmo padrao do conversaId). Sem cookie, sem conta.
- **Tabela `memorias`** (migration 0021): `id`, `device_id` text,
  `resumo` text, `criado_em`. 1 linha por conversa encerrada; leitura
  pega as 5 mais recentes. Grants service_role (padrao das migrations).
- **Escrita**: novo endpoint `POST /api/memoria` chamado pelo frontend
  no encerramento do atendimento (fire-and-forget). Recebe
  {dispositivoId, historico}; se houver conversa suficiente, um modelo
  LITE resume os fatos uteis do usuario em ate 2 frases ("preferencias,
  pedidos, pendencias") — resposta "NADA" ou vazia nao grava. Rate
  limit proprio (10/min por IP+device).
- **Leitura**: /api/chat aceita `dispositivoId`; SOMENTE no primeiro
  turno (historico vazio) busca as memorias e injeta no prompt um bloco
  "Memorias de sessoes anteriores deste usuario" — uso natural, nunca
  recitar como lista. Disparado em paralelo com RAG/modelo/cache como
  as demais cargas de contexto. Sem dispositivoId ou sem memorias,
  nada muda.
- **Custo**: 1 chamada pequena de LLM por conversa encerrada (modelo
  lite) + 1 select leve por primeira mensagem. Aceitavel.
- **Privacidade**: so fatos que o proprio usuario contou na conversa;
  resumo generico, sem dados de pagamento/endereco. Documento na spec
  fica claro para entrevista de LGPD basica.

## Fora de escopo (V2)

- Auth/login e memoria por conta (fase 2 do capability-map)
- Edicao/exclusao de memorias pelo usuario ("esqueca isso")
- Memoria semantica com embeddings (busca por relevancia) — V1 injeta
  as 5 mais recentes
- Memoria em conversas que nao encerram formalmente (timeout do
  navegador perde a escrita — aceitavel)

## Boundaries

- Always: validacao estrita de entrada; rate limit; LLM so no servidor;
  typecheck + testes + build antes de commitar.
- Ask first: aplicar migration 0021 no Supabase via MCP.
- Never: enviar historico cru do usuario para a tabela (so o resumo);
  injetar memorias em turnos com historico (polui follow-ups); gravar
  memoria de conversa sem conteudo relevante.

## Criterios de sucesso

- Conversa encerrada gera resumo na tabela memorias (verificavel via
  SQL/MCP read).
- Nova conversa do mesmo dispositivo recebe o bloco de memorias no
  prompt e a Nori usa o contexto naturalmente.
- /api/chat sem dispositivoId ou com id invalido: comportamento
  identico ao atual.
- POST /api/memoria com historico curto/vazio: 200 sem gravar.
