import { defineConfig } from 'vitest/config';

// Configuracao de testes unitarios dos modulos de servidor (api, rag, coherence, shared)
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Testes de integracao chamam LLMs reais: em paralelo eles saturam o RPM
    // do free tier e derrubam cenarios que passam isolados — rodar em serie
    fileParallelism: false,
  },
});
