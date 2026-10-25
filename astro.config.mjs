import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://enicarworld.com',
  trailingSlash: 'always',
  build: { format: 'directory' }
});
