import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/*
 * base: GitHub Pages sirve el proyecto bajo /<nombre-del-repo>/.
 * Si despliegas en otro sitio (Netlify, un dominio propio), exporta
 * VITE_BASE=/ antes de compilar.
 */
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/HealthWeWearGroup/',
  build: { outDir: 'dist', sourcemap: false }
});
