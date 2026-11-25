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
   **IMPORTANTE: o PDF e de uso pessoal, NUNCA commitar no repo.**
   Antes de editar, fazer backup (`Guia Kora iFood - backup.pdf`).

### REGRA CRITICA — nunca mexer no guia sem pedido explicito

- **NAO editar o `Guia Kora iFood.pdf` a menos que o usuario peca
  explicitamente.** O usuario edita o guia por conta propria; qualquer
  alteracao (secao nova, correcao, formatacao) so com solicitacao
  direta na conversa.
- **NUNCA alterar, resumir, traduzir ou "melhorar" o texto existente do
  guia.** Somente ACRESCENTAR secoes novas ou CORRIGIR formatacao
  (cores, espacamento, numeracao). Se uma feature exigir mudanca de
  texto existente, perguntar ao usuario antes.
- Qualquer edicao deve ser incremental (insert_text/redact cirurgico
  com PyMuPDF), nao rebuild do documento inteiro — rebuild so e
  aceitavel se o usuario pedir explicitamente.
- Depois de editar, validar que o texto existente saiu identico
  (comparar extracao antes/depois).

### Estilo do guia — O QUE PRESERVAR ao editar

- **Tema unico**: todas as paginas seguem o estilo das paginas 1-5 —
  titulos/secoes em Helvetica-Bold ~12pt cor navy (0x0f172a), corpo
  Helvetica ~9.8pt cor 0x1e293b, texto secundario 0x475569. NUNCA
  deixar trechos em Helvetica 10 preta — foi o erro que gerou as
  paginas 6-9 originais em estilo divergente.
- **Elementos com cor**: ha spans inline coloridos (ex.: 0xf162a,
  0x1d4ed8) e "chips" de texto preto (ex.: "15 modelos", "~70 testes")
  embutidos no meio das frases — sao parte do design, preservar
  fonte/tamanho/cor de CADA span, nao so do paragrafo.
- **Bullets**: o caractere '•' (U+2022) NAO pode ser inserido via
  fontname 'helv' — o PyMuPDF o converte em '·' (U+00B7). Inserir como
  'l' com fontname 'zapfdingbats' (renderiza a bolinha cheia).
- **Acentos**: Latin-1 (ç ã é etc.) e seguro com helv; o unico char
  >255 do documento e o '•'.
- **Espacamento compacto**: leading ~1.2x o corpo (nao 1.35x), gaps de
  paragrafo curtos — o documento foi reformatado de 9 para 6 paginas
  justamente para evitar paginas esparsas. Manter esse criterio.
- **Rodape**: faixa branca y782-842 com "Guia de Estudo GenAI, LLMs e
  Arquitetura Cloud - Kora / Nori" a esquerda (x50) e "Page N of M"
  a direita (terminando em x545), Helvetica 8pt cinza.
- **Pagina**: A4 (595x842), coluna unica, conteudo entre ~x54 e ~x545.
- **Rebuild seguro**: extrair spans por baseline (get_text('dict')),
  preservar x absoluto de cada span e re-fluir so no eixo Y; nao
  re-quebrar linhas manualmente. Comparar contagem de caracteres antes
  e depois para garantir que nenhum texto se perdeu.
7. **Commit + push** — `git push origin main` sempre; mensagem em
   portugues.

## Tom do guia

- Explicar como se fosse para um iniciante: analogia primeiro, detalhe
  depois.
- Sempre responder: "o que e?", "o que faz?", "por que e interessante?".
- Incluir uma "frase pronta" memorizavel por feature.
- Manter resumido: ~1 pagina por bloco tematico, nao documentacao
  exaustiva.
