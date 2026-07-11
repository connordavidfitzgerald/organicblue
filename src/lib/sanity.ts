import { sanityClient } from 'sanity:client'
import { createImageUrlBuilder } from '@sanity/image-url'
import type { SanityImageSource } from '@sanity/image-url/lib/types/types'
import { defineQuery } from 'groq'

// ── Image URL builder ──────────────────────────────────────────────────────
const builder = createImageUrlBuilder(sanityClient)

export function urlFor(source: SanityImageSource) {
  return builder.image(source)
}

// ── Types (shape of the projected query results) ───────────────────────────
export interface ArchiveCollectionSummary {
  _id: string
  title: string
  slug: string
  coverImage: SanityImageSource | null
}

export interface ArchiveCollectionDetail {
  title: string
  slug: string
  images: (SanityImageSource & { alt?: string })[]
}

export interface ExplorationImageDoc {
  image: SanityImageSource & { alt?: string }
  category: string
}

// ── Queries ────────────────────────────────────────────────────────────────
const ARCHIVE_COLLECTIONS_QUERY = defineQuery(`
  *[_type == "archiveCollection"] | order(order asc, title asc) {
    _id,
    title,
    "slug": slug.current,
    coverImage
  }
`)

const ARCHIVE_COLLECTION_QUERY = defineQuery(`
  *[_type == "archiveCollection" && slug.current == $slug][0] {
    title,
    "slug": slug.current,
    images
  }
`)

const EXPLORATION_IMAGES_QUERY = defineQuery(`
  *[_type == "explorationImage" && defined(image.asset)] | order(order asc, _createdAt asc) {
    image,
    category
  }
`)

// ── Memoized helpers (one fetch per build, like getProducts) ───────────────
let collectionsCache: Promise<ArchiveCollectionSummary[]> | null = null

export function getArchiveCollections(): Promise<ArchiveCollectionSummary[]> {
  return (collectionsCache ??= sanityClient.fetch(ARCHIVE_COLLECTIONS_QUERY))
}

export function getArchiveCollection(
  slug: string,
): Promise<ArchiveCollectionDetail | null> {
  return sanityClient.fetch(ARCHIVE_COLLECTION_QUERY, { slug })
}

let explorationCache: Promise<ExplorationImageDoc[]> | null = null

export function getExplorationImages(): Promise<ExplorationImageDoc[]> {
  return (explorationCache ??= sanityClient.fetch(EXPLORATION_IMAGES_QUERY))
}
