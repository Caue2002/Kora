-- Migracao 0017: saneamento do catalogo apos reteste de cota do Gemini
-- (scripts/testar_modelos_gemini.mjs, 26/11/2026):
--   gemini-4-argon, gemini-3.1-pro-preview e gemini-pro-latest
--   responderam 429 persistente ("exceeded your current quota") em duas
--   rodadas — sem free tier, confirmado. Sao removidos de modelos_ia.
-- Os slots 503 "high demand" (hydrogen, 3.8/3.6/3.5-flash, 3.7-flash,
-- flash-latest) foram MANTIDOS: o erro e saturacao temporaria de
-- capacidade, nao falta de cota, e esses modelos ja responderam 200.
--
-- Remocao exige limpar as FKs antes do delete:
--   cotas_modelos.modelo_id      -> apaga contadores de cota dos slots
--   feedback_respostas.modelo_id -> anula a referencia (preserva o voto)
-- metricas_chat.modelo e texto livre (sem FK) e segue registrando
-- historico dos modelos removidos.
--
-- Prioridades renumeradas sem buracos (unique(prioridade)):
--   flash-latest (id 13): 12 -> 11
--   pollinations (id 10): 15 -> 12  (ultimo da fila, id preservado por FK)
-- O check de modelos_ia.id (1-15) continua valido para os ids restantes.
-- Aplicar no SQL Editor do Supabase ou via MCP com aprovacao do usuario.

delete from cotas_modelos where modelo_id in (12, 14, 15);

update feedback_respostas set modelo_id = null where modelo_id in (12, 14, 15);

delete from modelos_ia where id in (12, 14, 15);

update modelos_ia set prioridade = 11 where id = 13;
update modelos_ia set prioridade = 12 where id = 10;
