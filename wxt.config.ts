import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'Easy Web Macros',
    description: 'Record your web actions and replay them with a single click',
    version: '2.0.0',
    permissions: ['storage'],
  },
});
