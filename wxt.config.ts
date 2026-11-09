import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'Easy Web Macros: Record & Replay',
    short_name: 'Easy Web Macros',
    action: { default_title: 'Easy Web Macros' },
    description: 'Record what you do on a website once, then replay it with one click. Edit the steps and watch each one as it plays.',
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
