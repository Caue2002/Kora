# CONTEXTO_ATUAL.md

Arquivo dedicado ao estado atual do desenvolvimento do Projeto Kora (Agente Nori).
Atualizar obrigatoriamente ao final de cada tarefa concluída.

## Fase atual

Scaffold V1 implementado: estrutura completa do projeto com frontend de chat,
endpoints de API, modulos RAG/coherence/shared e schema do banco.
Aguardando validacao local (npm install/test/build) e configuracao de credenciais.

## O que esta pronto

- Estrutura de pastas: frontend/, api/, rag/, coherence/, database/, docs/, shared/
- frontend/: chat mobile-first (Vite+React+TS), sessionStorage, acoes copiar/exportar/feedback
- api/: POST /api/chat (orquestracao completa) e POST /api/feedback
- shared/: env, cliente Supabase, cliente LLM (Gemini/Groq/Cerebras/OpenRouter),
  tokens e controle de cotas com failover
- rag/: chunking, embeddings Gemini (1536 dims) e busca hibrida via RPC
- coherence/: prompt do Nori, diretrizes adaptativas por feedback, validacao de coerencia
- database/: migracao 0001 (schema pgvector), 0003 (RPCs de cota e busca), seed 0004 (modelos)
- Testes unitarios em tests/ (chunking, tokens, prompt, cotas, validacao)
- Validacao local concluida: 15 testes passando, tsc --noEmit limpo, vite build ok
- Configs: package.json raiz e frontend, tsconfig, vercel.json, .env.example, .gitignore
- Git inicializado com commit inicial

## Em andamento

- Nenhuma implementacao em curso; scaffold validado localmente

## Decisoes tecnicas tomadas

- Ver docs/DECISOES.md (D01 a D09)
- Resumo: Vite+React frontend, Vercel Functions Node/TS em api/, shared/ para
  logica de servidor, Gemini principal + Groq/Cerebras/OpenRouter contingencia,
  embeddings gemini-embedding-001 em 1536 dimensoes

## Pendencias (proximos passos, em ordem)

1. Aplicar migracoes 0001, 0003 e seed 0004 no Supabase e popular regras reais da RotaLeve
2. Obter chaves de API (Gemini, Supabase, Groq, Cerebras, OpenRouter), preencher .env
   e configurar variaveis na Vercel
3. Deploy na Vercel e teste de ponta a ponta do chat
4. Implementar resumo de contexto/fatos confirmados na troca de modelo (janela atual e basica)
5. Validacao de coerencia via LLM esta implementada mas so roda quando a heuristica falha;
   avaliar ativacao permanente conforme custo de tokens

## Protocolo de handoff (troca de modelo/sessao)

Ao iniciar uma nova sessao, o agente deve:

1. Ler este arquivo e os documentos relevantes em docs/
2. Conferir o que esta pronto, em andamento, decisoes tomadas e pendencias
3. Retomar exatamente do proximo passo registrado, sem refazer etapas concluidas
