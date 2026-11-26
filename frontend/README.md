# frontend/

Interface do chat com o agente Nori — React + Vite + TypeScript, mobile-first.

- Chat com streaming token a token, markdown completo (tabelas, codigo,
  checklist clicavel, citacoes), citacoes inline das regras do RAG
- Sidebar de historico estilo Gemini (sessionStorage — o historico morre
  com a aba, busca removida,
  renomear/excluir), tema escuro, modo foco, ditado por voz (Web Speech API)
- Acoes: copiar, avaliar com comentario, exportar parecer (HTML), botoes
  rapidos Resumir caso e Checklist
- PWA instalavel (manifest + service worker)

Paleta azul tech: fundo branco, usuario em gradiente azul, agente branco
com borda azul-clara, acentos #2563EB/#1D4ED8/#06B6D4.

## Scripts

- `npm run dev` — Vite dev server (proxy /api -> localhost:3000)
- `npm run build` — typecheck + build de producao em `dist/`
- `npm run preview` — serve o build localmente
