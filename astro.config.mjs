// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: "https://cjreviews.co.uk",
  output: "server",
  adapter: vercel({
    // Pages are rendered on demand and cached at the edge for 60s, so newly
    // published Notion posts appear on refresh without a redeploy.
    isr: {
      expiration: 60,
      // The image proxy sets its own year-long immutable cache header (its URLs
      // are versioned, so they only change when the image does). Leaving it on
      // ISR would instead re-fetch every image from Notion every 60s.
      exclude: [/^\/api\/img\//],
    },
  }),
  // Note: @astrojs/sitemap only enumerates build-time routes, so it emits
  // nothing useful under `output: "server"`. See src/pages/sitemap-index.xml.ts.
  integrations: [svelte()],
  vite: {
    plugins: [tailwindcss()],
  },
});
