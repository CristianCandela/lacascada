import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));

// En modo "mock" (solo para pruebas) se reemplaza supabase-js por una simulación en memoria.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: mode === 'mock'
      ? { '@supabase/supabase-js': path.resolve(aqui, 'src/mock/supabase-mock.js') }
      : {}
  }
}));
