// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  adapter: vercel(),
  devToolbar: { enabled: false },
  // Trust Vercel's forwarded host for these domains. Without this, on-demand
  // routes see the host as "localhost" and Astro's origin check rejects
  // same-site form POSTs (e.g. the /showcase password form).
  security: {
    allowedDomains: [
      { hostname: 'marshallnorman.com', protocol: 'https' },
      { hostname: 'www.marshallnorman.com', protocol: 'https' },
      { hostname: '**.vercel.app', protocol: 'https' },
    ],
  },
  vite: {
    plugins: [tailwindcss()]
  }
});