---
name: fluxo-kora
description: Manter a pagina local de apresentacao "Fluxo Kora" (Fluxo Kora/index.html) sincronizada com o projeto. Use ao final de QUALQUER tarefa que altere comportamento visivel ao usuario, arquitetura, endpoints, modelos, categorias, etapas do caso, tabelas, limites ou numeros de testes/metricas — antes de commitar. A pagina e material de entrevista (HTML unico, fora do git) e so e util se refletir o estado real do codigo.
---

# Skill: fluxo-kora — pagina de apresentacao do Projeto Kora

A pasta `Fluxo Kora/` contem `index.html` (pagina unica, sem dependencias,
HTML+CSS+JS+SVG inline) e `README.md` (protocolo completo). A pasta esta no
`.gitignore`: e material LOCAL de entrevista, nunca commitada.

## Quando usar

Ao final de qualquer tarefa que mude algo que um entrevistador perguntaria:

- endpoints ou fluxo do `/api/chat` (ordem de etapas, atalhos, guardrails)
- catalogo de modelos (`shared/env.ts`, `MODELOS_FAILOVER`)
- categorias de disputa, etapas do caso, tabelas/RPCs do Supabase
- rate limits, timeouts, cotas, headers de seguranca
- numeros do hero (testes, politicas, modelos) e secoes de capacidades
- features novas (nova tool, protocolo, endpoint, UI relevante)

## Checklist obrigatorio

1. **Leia `docs/CONTEXTO_ATUAL.md`** (ou o diff da tarefa) e liste o que mudou
   que aparece na pagina.
2. **Ctrl+F no `index.html`** pelos termos afetados (modelos, endpoints,
   categorias, limites, numeros). Ajuste textos, numeros e dados dos
   diagramas.
3. **Diagramas** — edite os arrays de dados no JS, nunca o HTML dos nos:
   - `DIAGRAMA_PIPELINE` — fluxo do `/api/chat` (~30 nos)
   - `DIAGRAMA_JORNADA` + `PASSOS` — jornada de 6 passos da disputa
   - `DIAGRAMA_CASO` — extracao de estado e conciliacoes
   - `DIAGRAMA_FAILOVER` + `MODELOS_FAILOVER` — cascata de modelos
   - `CENARIOS` — mensagens do chat de demonstracao
4. **Novos nos/arestas**: posicione em px dentro do `larguraNatural` do
   diagrama (pipeline/caso/failover = 1060–1200, jornada = 1600), sem
   sobrepor outros nos (espaco vertical ~80px por no).
5. **Verifique**: abra `Fluxo Kora/index.html` no navegador — console sem
   erros, 4 diagramas desenhados, sem nos sobrepostos, mobile ok
   (`window-size` pequeno ou DevTools).
6. **Docs**: se a feature mudou o projeto, `docs/CONTEXTO_ATUAL.md` ja deve
   ter sido atualizado pela skill `atualizar-documentacao` — mantenha os
   dois coerentes.
7. **NAO commitar** `Fluxo Kora/` (ja esta no `.gitignore`). Commitar apenas
   `.gitignore`, `spec/` e `docs/` se mudaram.

## Regras de ouro do arquivo

- Portugues SEM acentos nos textos (padrao do projeto); acentos so em
  comentarios se necessario.
- Zero dependencias externas — nao adicionar CDN, fontes ou imagens
  remotas. Logo local: `../frontend/public/logo.png`.
- Ao editar, preserve o comentario de protocolo no topo do `<style>`.
- Impressoes: a pagina tem CSS `@media print` — `Ctrl+P` gera PDF limpo.
