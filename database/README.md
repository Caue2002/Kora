# database/

Scripts SQL, migracoes, indices e estrutura relacional/vetorial do Supabase.

- migrations/ : migracoes versionadas do PostgreSQL com pgvector
  (0000 instalacao completa ate 0015; inclui o seed SQL 0004 dos modelos)
- seeds/ : seeds de conhecimento em JSON consumidos por
  scripts/ingerir_conhecimento.mjs (politicas_disputa.json)
