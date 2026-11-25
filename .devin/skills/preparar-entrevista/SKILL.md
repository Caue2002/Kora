# Skill: preparar-entrevista

Protocolo para adicionar uma feature relevante ao Projeto Kora mantendo o
pacote de entrevista sempre atualizado. Use sempre que uma tarefa criar ou
mudar algo que um avaliador tecnico perguntaria (arquitetura, feature,
protocolo, metrica).

## Checklist obrigatorio ao concluir uma feature

1. **Spec SDD** — se a capacidade for nova, criar `spec/SPEC-<nome>.md`
   antes de implementar (ver skill spec-driven-development). Specs de
   features ja implementadas ficam com `Status: implementado`.
2. **Codigo** — seguir padroes do projeto: handlers `(req: Request) =>
   Promise<Response>` em `api/`, adaptador `shared/http.ts` para Vercel,
   comentarios em portugues explicando o que a funcao faz, segredos so em
   env vars (`.env.example` documenta as novas).
3. **Testes** — `tests/<feature>.test.ts` no padrao vitest existente;
   testes de integracao pulam sem credenciais. Rodar `npm run typecheck`,
   `npm test` e `npm --prefix frontend run build` antes de commitar.
4. **docs/CONTEXTO_ATUAL.md** — adicionar bullet em "O que esta pronto"
   (ou "Em andamento" se depender de config externa) e pendencias novas.
5. **README.md** — atualizar se a feature muda a descricao do produto,
   a cadeia de failover ou a lista de funcionalidades/tecnologias.
6. **Guia de entrevista** — `Guia Kora iFood.pdf`
   em `C:\Users\caue\Downloads\`: adicionar pagina/seção nova no MESMO
   estilo (Helvetica, titulos hebo 12pt cor 0x0f172a, corpo helv ~9.8pt
   cor 0x1e293b, rodape cinza 8.5pt "...Kora / Nori    Page N of M").
   Conteudo: o que e o conceito em linguagem simples, o que foi
   implementado, por que importa na entrevista e frase pronta. Usar
   PyMuPDF (ja instalado) para editar; atualizar numeracao "of M" em
   todos os rodapes e numeracao de secoes.
7. **Commit + push** — `git push origin main` sempre; mensagem em
   portugues.

## Tom do guia

- Explicar como se fosse para um iniciante: analogia primeiro, detalhe
  depois.
- Sempre responder: "o que e?", "o que faz?", "por que e interessante?".
- Incluir uma "frase pronta" memorizavel por feature.
- Manter resumido: ~1 pagina por bloco tematico, nao documentacao
  exaustiva.
