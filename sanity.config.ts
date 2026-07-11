import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { schemaTypes } from './src/sanity/schemaTypes'

// Embedded Studio served by Astro at /admin (see astro.config.mjs studioBasePath).
export default defineConfig({
  name: 'organicblue',
  title: 'Organic Blue',
  projectId: import.meta.env.PUBLIC_SANITY_PROJECT_ID,
  dataset: import.meta.env.PUBLIC_SANITY_DATASET,
  plugins: [structureTool(), visionTool()],
  schema: {
    types: schemaTypes,
  },
})
