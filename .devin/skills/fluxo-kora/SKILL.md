---
name: fluxo-kora
description: Manter a pagina local de apresentacao "Fluxo Kora" (Fluxo Kora/index.html) sincronizada com o projeto. Use ao final de QUALQUER tarefa que altere comportamento visivel ao usuario, arquitetura, endpoints, modelos, categorias, etapas do caso, tabelas, limites ou numeros de testes/metricas — antes de commitar. A pagina e material de entrevista (HTML unico, fora do git) e so e util se refletir o estado real do codigo.
---

# Skill: fluxo-kora — pagina de apresentacao do Projeto Kora

A pasta `Fluxo Kora/` contem `index.html` (pagina unica, tema claro,
HTML+CSS+JS inline, SEM dependencias e SEM SVG — diagramas sao componentes
HTML: `.pipeline/.estagio`, `.fluxo-h/.fno`, `.fail-lista`) e `README.md`
(protocolo completo). A pasta esta no `.gitignore`: e material LOCAL de
entrevista, nunca commitada.

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
3. **Diagramas** — edite os arrays de dados no JS, nunca o HTML gerado:
   - `FNOS` + `FARESTAS` + `ORDEM_FLUXO` — fluxograma real do `/api/chat`
     (canvas absoluto + arestas SVG; nos tem x,y,w,h,k=io/p/d/s)
   - `PASSOS` — jornada de 6 passos (titulo, descricao, passos internos,
     mensagens do chat demo)
   - `CASO` — ciclo de vida do caso (colunas `.diag-flow` horizontais)
   - `MODELOS_FAILOVER` — cascata dos 12 modelos
4. **Verifique**: abra `Fluxo Kora/index.html` no navegador — console sem
   erros, todos os diagramas renderizados, SEM scroll horizontal
   (`window-size` pequeno ou DevTools), chat demo animando ao clicar nos
   passos da trilha.
5. **Docs**: se a feature mudou o projeto, `docs/CONTEXTO_ATUAL.md` ja deve
   ter sido atualizado pela skill `atualizar-documentacao` — mantenha os
   dois coerentes.
6. **NAO commitar** `Fluxo Kora/` (ja esta no `.gitignore`). Commitar apenas
   `.gitignore`, `spec/` e `docs/` se mudaram.

## Regras de ouro do arquivo

- Portugues SEM acentos nos textos (padrao do projeto).
- Zero dependencias externas — nao adicionar CDN, fontes ou imagens
  remotas. Logo local: `../frontend/public/logo.png`.
- Tema CLARO (sidebar fixa + `main`); manter o layout `.layout`/`.side`.
- Diagramas SEM scroll horizontal na pagina: a barra de rolagem e INTERNA
  (`.diag-scroll` overflow-x). Fluxograma usa canvas de 2280px — ao mover um
  no, confira que nao sobrepoe outro (mesma faixa y) nem aresta.
- Ao editar, preserve o comentario de protocolo no topo do `<style>`.
- Impressoes: a pagina tem CSS `@media print` — `Ctrl+P` gera PDF limpo.
