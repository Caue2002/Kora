# Registro de Decisoes Tecnicas

Registro curto das decisoes tecnicas tomadas no Projeto Kora e seus motivos.
Manter atualizado a cada decisao relevante para evitar reversoes indevidas.

## D01 - Hospedagem: Vercel + Supabase

- Decisao: frontend e funcoes serverless na Vercel; PostgreSQL no Supabase com pgvector.
- Motivo: camadas gratuitas amplas, deploy simples de serverless e pgvector nativo
  para busca semantica sem servico adicional.

## D02 - Modelos de IA: fila de 4 gratuitos, Gemini principal

- Decisao: roteamento Modelos 1 a 4 com Gemini como principal e 3 provedores
  gratuitos de contingencia; troca automatica ao atingir limite de tokens.
- Motivo: custo zero e resiliência; exigencia explicita da especificacao.

## D03 - Temperatura baixa e grounding estrito

- Decisao: temperatura 0 a 0.1 em todas as chamadas; respostas so podem afirmar
  o que estiver no contexto recuperado ou nos fatos informados pelo usuario.
- Motivo: dominio operacional exige determinismo e prevencao de alucinacao.

## D04 - Aprendizado por feedback, sem fine-tuning

- Decisao: evolucao do Nori via loop de feedback agregado (util, confuso, incompleto,
  prolixo) que ajusta diretrizes injetadas no prompt; resolucoes validadas entram
  na base RAG.
- Motivo: modelos gratuitos nao permitem treino de pesos; abordagem controlada
  e auditavel.

## D05 - Respostas 100% geradas por IA

- Decisao: nenhum texto estatico pre-escrito no codigo; ate esclarecimentos e
  recusas sao gerados pelo modelo ativo sob as diretrizes do Nori.
- Motivo: exigencia explicita da especificacao (secao 4).

## D06 - Esquema de conhecimento unificado

- Decisao: regras da Kora e resolucoes validadas compartilham a tabela
  conhecimento_chunks com coluna origem, simplificando o RAG.
- Motivo: uma unica base vetorial reduz complexidade de ingestao e busca.

## D07 - Stack: Vite + React + Vercel Functions (Node/TypeScript)

- Decisao: frontend estatico com Vite+React+TS; api/ com funcoes serverless
  Node em TypeScript na Vercel; modulos de servidor compartilhados em shared/.
- Motivo: separacao fiel a estrutura do PDF (frontend/ e api/ distintas),
  deploy simples e gratuito na Vercel, sem framework pesado no frontend.
- Observacao: na Vercel, todo arquivo .ts dentro de api/ vira endpoint publico;
  por isso a logica compartilhada fica em shared/ e api/ contem apenas os handlers.

## D08 - Modelos: Gemini principal + Groq, Cerebras, OpenRouter

- Decisao: fila de 4 modelos gratuitos configuravel por env; catalogo e limites
  tambem persistidos no PostgreSQL (modelos_ia, cotas_modelos).
- Motivo: exigencia da especificacao; todos possuem camadas gratuitas conhecidas.
- Ressalva: disponibilidade e limites dos free tiers devem ser confirmados
  manualmente; nomes de modelo podem ser ajustados via variaveis de ambiente
  sem alterar codigo.

## D09 - Embeddings: gemini-embedding-001 com 1536 dimensoes

- Decisao: coluna embedding vector(1536); chamadas usam outputDimensionality=1536.
- Motivo: free tier do Gemini e compatibilidade com a dimensao fixada no schema.
