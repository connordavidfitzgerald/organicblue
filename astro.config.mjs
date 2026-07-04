// @ts-check
import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  output: 'static',
  image: {
    // Allow Astro's <Image>/getImage to optimize Shopify-hosted product images.
    domains: ['cdn.shopify.com'],
  },
  vite: {
    plugins: [tailwindcss()],
  },
})