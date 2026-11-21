import { defineConfig } from 'vitest/config';

// Configuracao de testes unitarios dos modulos de servidor (api, rag, coherence, shared)
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
