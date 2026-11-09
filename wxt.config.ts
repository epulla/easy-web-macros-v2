import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'Easy Web Macros',
    description: 'Record your web actions and replay them with a single click',
    version: '0.1.0',
    permissions: ['storage'],
    commands: {
      'toggle-recording': {
        suggested_key: { default: 'Alt+Shift+R' },
        description: 'Start or stop recording',
      },
    },
  },
});
