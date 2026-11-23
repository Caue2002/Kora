# api/

Funcoes serverless hospedadas na Vercel.

- Validacao de entrada das mensagens
- Controle de orcamento de tokens por modelo
- Alternancia automatica entre os modelos gratuitos configurados (Gemini/Groq/Pollinations) por limite de tokens ou falha, com failover imediato para o proximo da fila
- Orquestracao do fluxo Nori (RAG + coherence)
