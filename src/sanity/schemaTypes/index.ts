import type { SchemaTypeDefinition } from 'sanity'
import { archiveCollection } from './archiveCollection'
import { explorationImage } from './explorationImage'

export const schemaTypes: SchemaTypeDefinition[] = [
  archiveCollection,
  explorationImage,
]
