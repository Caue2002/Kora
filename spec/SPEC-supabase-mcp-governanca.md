# Spec: Governanca do Supabase MCP — V1

Status: implementado

## Objetivo

Definir e registrar as regras de uso do **Supabase MCP server** no Projeto
Kora: o servidor MCP hospedado pela Supabase (`https://mcp.supabase.com/mcp`),
configurado em `.devin/mcp_config.local.json` com escopo no projeto
`uzkiayjqcjztzrwestcg` e acesso de leitura e escrita.

O banco de dados e o coracao do Nori (casos, conciliacoes, cotas de modelos,
metricas, conhecimento RAG). Acoes de escrita via MCP (migrations, DELETE,
UPDATE, INSERT via `execute_sql`/`apply_migration`) podem corromper dados de
producao ou contornar o fluxo de migrations versionadas do repositorio
(`database/migrations/`).

**Regra principal (nao negociavel):** e **estritamente proibido** usar o MCP
do Supabase para realizar acoes de escrita sem aprovacao explicita do usuario.
O agente pode usar o MCP livremente para **acoes de leitura**, mas **toda acao
de escrita exige aprovacao explicita do usuario antes de executar** — nunca
por inferencia, nunca "porque parecia obvio".

### Criterios de aceitacao

- Toda interacao com ferramentas `mcp__supabase__*` de escrita
  (`apply_migration`, `execute_sql` com DML/DDL, `deploy_edge_function`,
  tools de auth/storage com efeito colateral) so ocorre apos confirmacao
  explicita do usuario naquela conversa.
- Acoes de leitura (`list_tables`, `list_migrations`, `list_extensions`,
  `execute_sql` somente-SELECT, `search_docs`, `query_logs`, `get_project`,
  `get_advisors`, `generate_typescript_types` etc.) podem ser usadas sem
  pedir permissao, idealmente informando o usuario do que esta consultando.
- O agente nunca contorna a regra usando outra via (ex.: script com
  service role key) para executar escrita que o MCP recusaria.
- Toda escrita aprovada via MCP e registrada em `docs/CONTEXTO_ATUAL.md`
  (ou commit equivalente) para rastreabilidade, ja que `apply_migration`
  registra no historico do Supabase fora do fluxo de arquivos de migration.

## Tech Stack

- Servidor: Supabase MCP hosted (`https://mcp.supabase.com/mcp`), transporte
  Streamable HTTP, autenticacao OAuth (escopo por `project_ref`).
- Config: `.devin/mcp_config.local.json` (gitignored — contem apenas a URL
  com project_ref, sem segredos; mantido local por padrao do projeto).
- Banco: PostgreSQL/Supabase projeto `uzkiayjqcjztzrwestcg`, RLS habilitado
  em todas as tabelas `public`.
- Alternativa documentada: servidor local stdio
  `npx -y @supabase/mcp-server-supabase@latest --access-token <PAT>` (nao
  adotada — OAuth remoto e mais simples e revogavel).

## Comandos

```bash
# Listar/inspecionar o servidor MCP configurado
devin mcp list
devin mcp get supabase

# Autenticar / re-autenticar (OAuth via navegador)
devin mcp login supabase
devin mcp logout supabase

# Config (arquivo real, gitignored)
# .devin/mcp_config.local.json
# { "mcpServers": { "supabase": { "url": "https://mcp.supabase.com/mcp?project_ref=uzkiayjqcjztzrwestcg", "transport": "http" } } }

# Fluxo de migrations do repositorio (via de escrita preferida, versionada)
npx supabase migration new <nome>   # se usar Supabase CLI
# ou criar arquivo em database/migrations/ conforme convencao do projeto
```

## Project Structure

```text
.devin/mcp_config.local.json  → config do MCP Supabase (local, gitignored)
AGENTS.md                     → secao "MCP" documenta o servidor e a regra
spec/SPEC-supabase-mcp-governanca.md → esta spec (regras de uso)
database/migrations/          → migrations versionadas (via preferida p/ escrita)
docs/CONTEXTO_ATUAL.md        → registrar escritas feitas via MCP
```

## Code Style

Politica textual — regras em portugues, diretas, sem ambiguidade:

```markdown
- Acoes de leitura do MCP Supabase: livres, sem aprovacao previa.
- Acoes de escrita do MCP Supabase: SOMENTE com aprovacao explicita do
  usuario. Pedir antes: descrever o que sera executado, o SQL exato e o
  impacto esperado; aguardar confirmacao.
```

## Testing Strategy

Spec de governanca — "teste" e comportamental:

- **Revisao de sessao:** verificar que nenhuma chamada
  `mcp__supabase__*` de escrita ocorreu sem pedido de aprovacao anterior na
  conversa.
- **Auditoria:** `list_migrations` / historico de migrations do Supabase
  deve bater com os arquivos em `database/migrations/` (divergencias
  indicam escrita fora do fluxo — investigar).
- Validacao de config: `devin mcp list` mostra `supabase` habilitado.

## Boundaries

- **Always:** usar o MCP para leitura quando ajudar o diagnostico; pedir
  aprovacao explicitando SQL/comando exato antes de qualquer escrita;
  preferir migrations versionadas em `database/migrations/` a
  `apply_migration` direto quando o cambio for estrutural.
- **Ask first:** qualquer `apply_migration`, `execute_sql` com
  INSERT/UPDATE/DELETE/DDL, seed de dados via MCP, alteracao de config do
  servidor MCP (escopo, `read_only`, headers), `devin mcp login/logout`.
- **Never:** executar escrita via MCP sem aprovacao explicita do usuario
  na conversa atual; usar `execute_sql` para contornar RLS ou policies;
  commitar segredos ou o `mcp_config.local.json` (ja gitignored);
  desligar `read_only` sem aprovacao; executar `COPY ... FROM PROGRAM`,
  `pg_read_file` etc. via SQL (proibido pela propria tool).

## Success Criteria

- Spec aprovada e referenciada no `AGENTS.md` (secao MCP ja aponta para
  estas regras).
- Zero acoes de escrita via MCP sem aprovacao explicita registrada.
- Divergencia entre migrations do Supabase e `database/migrations/`
  explicada e documentada em `docs/CONTEXTO_ATUAL.md`.
- Novo agente/sessao que leia `AGENTS.md` + esta spec reproduz o
  comportamento correto sem ambiguidade.

## Out of Scope (Deferred)

- Migrar a config para escopo `project` (`.devin/mcp_config.json`
  commitado) — adiado: URL contem project_ref e a decisao de compartilhar
  e do time.
- Adotar `read_only=true` na URL como trava tecnica adicional — possivel
  V2, mas conflita com o uso eventual de migrations via MCP.
- Servidor MCP local via access token (PAT) — descartado por ora.
- Permissoes granulares em `permissions` do Devin (ex.: allow so tools de
  leitura `mcp__supabase__*`) — avaliar se a regra textual se mostrar
  insuficiente.

## Open Questions

- A regra vale para **todos** os agentes/ferramentas do projeto ou apenas
  sessoes Devin? (Assumido: todas as sessoes do agente no repo.)
- Escritas aprovadas via MCP devem tambem gerar arquivo de migration no
  repo para espelhar o historico? (Assumido: sim, quando estrutural;
  dados/seeds podem ficar so no Supabase.)
