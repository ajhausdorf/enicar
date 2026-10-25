import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://enicar-archive.pages.dev',
  trailingSlash: 'always',
  build: { format: 'directory' }
});
