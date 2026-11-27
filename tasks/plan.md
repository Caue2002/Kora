# Plan: Fallback em camadas (SPEC-fallback-camadas)

## Componentes

1. `database/migrations/0016_fallback_em_camadas.sql` — coluna `escopo`
   em `cache_respostas`, `buscar_cache_resposta` filtrando `geral`, nova
   `buscar_cache_fallback` (score>=0.80 via codigo, qualquer escopo),
   tabela `fallback_respostas` + seeds, grants.
2. `coherence/fallback.ts` (na epoca `api/fallback.ts`) — `VARIANTES_FALLBACK`, `ehFallback`,
   `detectarIntencaoFallback`, `escolherVarianteFallback`,
   `resolverFallback` (cache relaxado -> banco por intencao -> variante).
3. `api/chat.ts` — substituir emissões de `RESPOSTA_FALLBACK` pelo
   resolver; gravacao de cache com `escopo` ('geral' vs 'fallback');
   metricas com camada do fallback.
4. `tests/fallback.test.ts` — intencao, variante estavel, resolver
   com mocks.

## Ordem

Migration -> modulo -> integracao chat -> testes -> validacao -> docs -> commit.

## Riscos

- Funcao SQL recriada muda contrato: mitigado mantendo assinatura de
  `buscar_cache_resposta` e filtrando escopo dentro dela.
- Resposta vinda de fallback nao pode ser regravada como 'geral': flag
  `veioDeFallback` bloqueia escrita de cache nesse turno.
- Sem embedding (mensagem casual/meta no meio da conversa) nao ha o que
  gravar no cache — limitacao aceita e documentada.
