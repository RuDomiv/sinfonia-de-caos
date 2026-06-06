import { defineConfig } from 'vite';

// base relativa => funciona en GitHub Pages (subruta /sinfonia-de-caos/)
// y tambien en Netlify/Vercel (raiz) sin tocar nada.
export default defineConfig({
  base: './',
});
