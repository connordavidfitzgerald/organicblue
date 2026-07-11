// @ts-check
import { defineConfig } from 'astro/config'
import { loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import sanity from '@sanity/astro'
import react from '@astrojs/react'

// astro.config.mjs runs before Astro's env loading, so PUBLIC_* isn't available
// on import.meta.env here — read it with Vite's loadEnv instead. Inside .astro
// files/components you can keep using import.meta.env.PUBLIC_SANITY_* directly.
const { PUBLIC_SANITY_PROJECT_ID, PUBLIC_SANITY_DATASET } = loadEnv(
  process.env.NODE_ENV ?? 'development',
  process.cwd(),
  '',
)

export default defineConfig({
  output: 'static',
  image: {
    // Allow Astro's <Image>/getImage to optimize Shopify-hosted product images.
    domains: ['cdn.shopify.com'],
  },
  integrations: [
    sanity({
      projectId: PUBLIC_SANITY_PROJECT_ID,
      dataset: PUBLIC_SANITY_DATASET,
      useCdn: true, // static build reads at build time; CDN is fine and fast
      studioBasePath: '/admin', // embedded Studio route
    }),
    react(), // required to render the embedded Studio
  ],
  vite: {
    plugins: [tailwindcss()],
  },
})
