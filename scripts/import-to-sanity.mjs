// One-shot seed: uploads the site's local images into Sanity.
//
//   node --env-file=.env scripts/import-to-sanity.mjs
//
// - WebScene: every file in src/assets/images/{environment,product,prototype,
//   research} is uploaded and gets an `explorationImage` doc tagged with its
//   folder name as `category` (so explorations keeps working immediately).
// - Archive: all files in src/assets/images/Archive are uploaded as bare assets
//   (unassigned) so they show up in the Studio's image picker; three empty
//   `archiveCollection` placeholders are created for you to fill + order + cover.
//
// Idempotent: re-runs skip exploration images whose source filename is already
// present, Sanity dedupes identical asset binaries by content hash, and the
// collections are only created when none exist yet.

import { createClient } from '@sanity/client'
import { readdir } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectId = process.env.PUBLIC_SANITY_PROJECT_ID
const dataset = process.env.PUBLIC_SANITY_DATASET
const token = process.env.SANITY_WRITE_TOKEN

if (!projectId || !dataset || !token) {
  console.error(
    'Missing env. Run with:  node --env-file=.env scripts/import-to-sanity.mjs\n' +
      'Requires PUBLIC_SANITY_PROJECT_ID, PUBLIC_SANITY_DATASET, SANITY_WRITE_TOKEN.',
  )
  process.exit(1)
}

const client = createClient({
  projectId,
  dataset,
  token,
  apiVersion: '2025-01-01',
  useCdn: false,
})

const __dirname = dirname(fileURLToPath(import.meta.url))
const IMAGES_DIR = join(__dirname, '..', 'src', 'assets', 'images')
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp'])

const EXPLORATION_CATEGORIES = [
  'environment',
  'product',
  'prototype',
  'research',
]

async function listImages(dir) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((e) => e.isFile() && IMAGE_EXT.has(extname(e.name).toLowerCase()))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b))
}

async function uploadAsset(path, filename) {
  const asset = await client.assets.upload('image', createReadStream(path), {
    filename,
  })
  return asset._id
}

async function seedExplorations() {
  // Skip source filenames already imported (dedupe on re-run).
  const existing = await client.fetch(
    `*[_type == "explorationImage"]{ "fn": image.asset->originalFilename }`,
  )
  const seen = new Set(existing.map((d) => d.fn).filter(Boolean))

  let created = 0
  let skipped = 0
  let order = 0
  for (const category of EXPLORATION_CATEGORIES) {
    const dir = join(IMAGES_DIR, category)
    const files = await listImages(dir)
    for (const file of files) {
      order += 1
      if (seen.has(file)) {
        skipped += 1
        continue
      }
      const assetId = await uploadAsset(join(dir, file), file)
      await client.create({
        _type: 'explorationImage',
        category,
        order,
        image: { _type: 'image', asset: { _type: 'reference', _ref: assetId } },
      })
      created += 1
      console.log(`  + explorationImage [${category}] ${file}`)
    }
  }
  console.log(`Explorations: ${created} created, ${skipped} skipped.`)
}

async function seedArchiveAssets() {
  const dir = join(IMAGES_DIR, 'Archive')
  const files = await listImages(dir)
  let uploaded = 0
  for (const file of files) {
    // Sanity dedupes identical binaries, so re-runs are cheap/no-op.
    await uploadAsset(join(dir, file), file)
    uploaded += 1
    console.log(`  + archive asset ${file}`)
  }
  console.log(`Archive assets: ${uploaded} uploaded (unassigned).`)
}

async function seedArchiveCollections() {
  const count = await client.fetch(`count(*[_type == "archiveCollection"])`)
  if (count > 0) {
    console.log(`Archive collections: ${count} already exist, skipping.`)
    return
  }
  for (let i = 1; i <= 3; i++) {
    await client.create({
      _type: 'archiveCollection',
      title: `Collection ${i}`,
      slug: { _type: 'slug', current: `collection-${i}` },
      order: i,
      images: [],
    })
    console.log(`  + archiveCollection "Collection ${i}"`)
  }
  console.log('Archive collections: 3 created.')
}

async function main() {
  console.log(`Seeding Sanity project ${projectId} / ${dataset}\n`)
  await seedExplorations()
  await seedArchiveAssets()
  await seedArchiveCollections()
  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
