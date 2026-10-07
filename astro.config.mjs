import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { SITE_URL } from './src/config/site.js';

// https://astro.build/config
export default defineConfig({
  // Absolute origin used for canonicals, Open Graph URLs and the sitemap.
  site: SITE_URL,
  // Keep URLs, canonicals and sitemap entries consistent (always trailing slash).
  trailingSlash: 'always',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
