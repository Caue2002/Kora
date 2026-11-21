# Arquitetura do Projeto Kora

Documento tecnico vivo do projeto. Atualizar a cada funcionalidade, mudanca de
arquitetura, criacao de tabela ou mudanca de regra de negocio.

## Visao geral

Sistema conversacional do agente de IA Nori para triagem, investigacao e
conciliacao de divergencias operacionais da empresa ficticia RotaLeve Logistica
& Abastecimento Ltda. O Nori conduz o operador por perguntas objetivas, separa
fatos de hipoteses, consulta regras reais no PostgreSQL e estrutura um plano de
conciliacao.

## Estrutura de pastas

| Pasta | Responsabilidade |
|---|---|
| frontend/ | Interface responsiva mobile-first contendo apenas o chat, controle de sessao na aba (sessionStorage), envio de mensagens e acoes rapidas de resposta |
| api/ | Funcoes serverless na Vercel: validacao de entrada, controle de orcamento de tokens, alternancia automatica entre os 4 modelos gratuitos e orquestracao do fluxo |
| rag/ | Ingestao, segmentacao (chunking), geracao de embeddings e busca hibrida rapida (lexical + vetorial) no PostgreSQL |
| coherence/ | Camada de conducao conversacional, aprendizado adaptativo controlado por regras/feedback e validacao obrigatoria de coerencia logica antes da entrega |
| database/ | Scripts SQL, migracoes, indices e estrutura relacional/vetorial (pgvector) no Supabase |
| docs/ | Documentacao tecnica viva e CONTEXTO_ATUAL.md para continuidade entre sessoes |
| shared/ | Modulos de servidor compartilhados (env, supabase, llm, tokens, models). Fora de api/ porque todo .ts dentro de api/ vira endpoint publico na Vercel |

### Estado da implementacao (V1)

- frontend/: chat mobile-first implementado (Vite+React+TS, sessionStorage, acoes copiar/exportar/feedback)
- api/: endpoints POST /api/chat e POST /api/feedback implementados
- shared/: config por env, cliente Supabase (PostgREST+RPC), cliente LLM dos 4 provedores, estimativa/contabilidade de tokens, selecao de modelo por cota
- rag/: chunking, embeddings Gemini e busca hibrida (RPC buscar_conhecimento_hibrido)
- coherence/: prompt do Nori, diretrizes adaptativas por feedback e validacao de coerencia (heuristica + LLM)
- database/: migracoes 0001 (schema), 0003 (RPCs) e seed 0004 (modelos)
- Pendente: aplicar migracoes no Supabase, popular regras reais da RotaLeve, obter chaves de API e configurar env na Vercel

## Interface (frontend/)

- Tela exclusiva de chat: apenas area de mensagens e campo de envio fixo no rodape.
- Sem menus laterais, navegacao complexa, graficos, cartoes decorativos ou widgets.
- Mobile-first: espaçamentos, fontes, areas de toque e rolagem automatico para a
  mensagem mais recente projetados primeiro para celular; boa proporcao em desktop.
- Paleta: fundo branco gelo #F8FAFC; mensagens do usuario em verde-esmeralda
  #065F46 com texto branco; mensagens do agente em branco #FFFFFF com borda
  cinza-ardosia #E2E8F0; acentos em verde-menta escuro #047857.
- Historico visual em sessionStorage (sobrevive a reload, descartado ao fechar a aba).
- Recursos leves: resumo do que foi fechado, checklist de conferencia, abertura
  automatica de novo contexto ao trazer outra ocorrencia, copiar/exportar parecer.

## RAG e prevencao de alucinacao (rag/)

- Busca hibrida de baixa latencia: pesquisa textual exata (codigos de ocorrencia,
  palavras-chave) combinada com busca semantica via pgvector.
- Retorna apenas trechos curtos e relevantes das regras da RotaLeve.
- Temperatura baixa (0 a 0.1) em todas as chamadas de LLM.
- Grounding estrito: o Nori so afirma regras, prazos e criterios presentes no
  contexto recuperado ou nos fatos informados pelo usuario.
- Nenhuma resposta estatica pre-escrita: tudo gerado dinamicamente pelo modelo ativo.

## Conducao, aprendizado e coerencia (coherence/)

- Conducao ativa: a cada turno o Nori sintetiza o confirmado, identifica lacunas
  criticas (etapa da falha, quantidade divergente, evidencia) e formula perguntas
  diretas. Assunto novo limpa o contexto pendente do caso anterior.
- Aprendizado adaptativo sem fine-tuning: avaliacoes (util, confuso, incompleto,
  prolixo) agregadas no Supabase; ao atingir limiares, ajustam diretrizes de
  estilo, detalhe e ordem de perguntas injetadas no prompt. Resolicoes validadas
  podem ser incorporadas a base RAG.
- Coerencia obrigatoria: toda resposta e verificada contra mensagens anteriores,
  regras recuperadas e evidencias antes de ser exibida; contradicoes ou falta de
  base sao ajustadas e sinalizadas.

## Modelos e controle de tokens (api/)

- 4 modelos gratuitos; Gemini como principal, demais na fila de contingencia.
- Ordem de prioridade Modelo 1 a 4; ao atingir limite da janela (minuto/hora/dia),
  o modelo e marcado como esgotado e a requisicao passa ao proximo.
- Estimativa de tokens antes da chamada com teto de seguranca; registro do consumo
  real (ou estimativa consolidada) apos a resposta, atualizado no PostgreSQL.
- Janela curta de historico (ultimas 4 a 6 interacoes), resumo enxuto dos fatos
  confirmados na troca de modelo ou proximidade do teto.
- Esgotamento total dos 4 modelos: informar temporariamente com clareza, sem inventar.
- Economia: cache no Supabase para contextos repetidos, limites de tamanho por
  turno, compressao de historico, observabilidade/evals em plano gratuito,
  GitHub Actions dentro da cota gratuita.

## Banco de dados (database/)

- PostgreSQL no Supabase com extensao pgvector.
- Tabelas: conhecimento_chunks (regras e resolucoes com embeddings),
  modelos_ia (catalogo dos 4 modelos), cotas_modelos (contadores por janela),
  feedback_respostas (avaliacoes) e de agregacao.
- Migracao inicial: database/migrations/0001_esquema_inicial.sql

## Regras operacionais do agente de codigo (Devin)

1. docs/ obrigatoriamente atualizada a cada funcionalidade, mudanca de arquitetura,
   tabela ou regra de negocio.
2. Commits em portugues, titulo claro e descricao objetiva e resumida.
3. Comentarios crus em portugues explicando o que cada funcao faz, sem formatacao
   decorativa.
4. Validacao obrigatoria antes de cada commit: testes do que foi alterado,
   integracao dos fluxos, ausencia de bugs e documentacao atualizada.
5. Manter registro de decisoes tecnicas (docs/DECISOES.md) e executar o conjunto
   fixo de cenarios de teste da RotaLeve (completos, incompletos/ambiguos,
   contraditorios e fora do escopo) apos mudancas relevantes.
