-- Migration 0012: backfill do modelo em metricas_chat
-- Linhas antigas de cache_hit e de erro eram gravadas com modelo null e
-- apareciam como "desconhecido" no painel /metricas.html. A partir de agora
-- o chat grava 'cache' (ou o modelo que gerou a resposta cacheada) e
-- 'indisponivel' nos erros de fila; este script alinha o historico.

update metricas_chat set modelo = 'cache', provedor = 'cache'
where modelo is null and cache_hit;

update metricas_chat set modelo = 'indisponivel'
where modelo is null and erro is not null;
