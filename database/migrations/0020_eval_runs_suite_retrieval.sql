-- Migracao 0020: suite 'retrieval' em eval_runs
-- (spec/SPEC-eval-retrieval.md, modulo eval-retrieval do capability-map)
--
-- O eval de retrieval mede se a buscaHibrida traz o trecho de politica
-- certo para cada tipo de disputa (hit@4). Para persistir o resultado
-- na mesma tabela eval_runs e preciso ampliar o check de `suite`,
-- que na migration 0019 aceitava apenas 'rubricas' e 'juiz'.
--
-- Aplicar no SQL Editor do Supabase ou via MCP com aprovacao do usuario.

alter table eval_runs drop constraint if exists eval_runs_suite_check;
alter table eval_runs
  add constraint eval_runs_suite_check
  check (suite in ('rubricas', 'juiz', 'retrieval'));
