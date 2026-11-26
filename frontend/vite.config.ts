import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build estatico do chat; em producao a Vercel serve dist/ e expoe /api/*
export default defineConfig({
  plugins: [react()],
  // .env unico na raiz do repo (compartilhado com a API): sem isso o
  // Vite so leria frontend/.env e as VITE_* nao apareceriam no build
  envDir: '..',
  server: {
    proxy: {
      // em dev local, repassa /api para o vercel dev ou funcao local
      '/api': 'http://localhost:3000',
    },
  },
});
